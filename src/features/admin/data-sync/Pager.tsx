import { Trans, useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { groupDigits, nextEnabledOnFullPage } from './helpers'

/**
 * The pager for a DataSync list door, which returns a plain array and **no total** (spec 558).
 * So there is no "of M": it reads "Page N", Previous from page 2 on, and Next only when this page
 * came back full (`nextEnabledOnFullPage`). Campaigns here; jobs (560) and changes (562) reuse it.
 *
 * `core/ui/GridPager` is not used: its readout is arithmetic on a total this door does not send.
 */
export default function Pager({
  page,
  pageSize,
  rowCount,
  busy,
  onPage,
}: {
  page: number
  pageSize: number
  /** Rows on the page now shown. */
  rowCount: number
  /** True while the next page is in flight; both buttons go inert. */
  busy: boolean
  onPage: (page: number) => void
}) {
  const { t } = useTranslation('data-sync')
  const { t: tc } = useTranslation('common')
  return (
    <nav
      aria-label={tc('pager.ariaLabel')}
      className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5"
      data-ds-pager={page}
    >
      <Button variant="outlined" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)} data-ds-prev="">
        <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {tc('pager.previous')}
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums" data-ds-page="">
        <Trans t={t} i18nKey="pager.readout" values={{ page: groupDigits(page) }} components={{ n: <Ltr /> }} />
      </span>
      <Button
        variant="outlined"
        disabled={!nextEnabledOnFullPage(rowCount, pageSize) || busy}
        onClick={() => onPage(page + 1)}
        data-ds-next=""
      >
        {tc('pager.next')}
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
      </Button>
    </nav>
  )
}
