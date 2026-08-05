import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageCountFromTotalMatches, pagerButtonEnablement } from './pager'

type Props = {
  page: number
  /** Rows a page — 50 on Ua Users, 25 on the Loy member's Actions tab. */
  pageSize: number
  /** Always needed: the "Page N of M" readout is arithmetic on it. */
  totalMatches: number
  /** True while the next page is in flight; both buttons go inert. */
  busy: boolean
  onPage: (page: number) => void
} & (
  | {
      /**
       * The envelope's "more rows exist beyond this page" flag, for a read that
       * knows nothing more than that (Ua Users).
       */
      isCapped: boolean
    }
  /**
   * Omit the flag when `totalMatches` is a real record count: Next is then
   * arithmetic. The `?: never` half is what makes the two paths a choice the
   * compiler checks — a caller holding a `boolean | undefined` fits neither
   * member and must decide which fact it actually has, rather than silently
   * falling onto the wrong path.
   */
  | { isCapped?: never }
)

/**
 * The grid footer (ticket 148, graduated to `core/ui` by ticket 232). Previous /
 * Next plus a "Page N of M" readout — no numbered pages, because *All people* is
 * 120 of them and nobody navigates to page 87 on purpose. The caller decides
 * whether to render this at all (`showsPager`); a one-page result grows no
 * controls.
 *
 * Its labels live in the `common` namespace, which every caller can reach — a
 * component in the shared layer cannot read a feature's namespace.
 */
export default function GridPager(props: Props) {
  const { page, pageSize, totalMatches, busy, onPage } = props
  const { t } = useTranslation('common')
  const pages = pageCountFromTotalMatches(totalMatches, pageSize)
  const { previous, next } = pagerButtonEnablement(
    props.isCapped === undefined
      ? { page, pageSize, totalMatches }
      : { page, pageSize, isCapped: props.isCapped },
  )

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
