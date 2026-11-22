import type { KeyboardEvent, ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { showsPager } from '@/core/ui/pager'
import { formatFigure } from '@/core/util/number-format'
import Loading from './Loading'
import RefusalBanner from './RefusalBanner'
import { STOCK_CONSOLE_PAGE_SIZE, frameView, type FrameRead } from './search'
import type { ListSearch } from './use-list-search'

/** The list's query as the frame reads it (a TanStack Query result fits). */
export interface FrameQuery extends FrameRead {
  error: unknown
  isFetching: boolean
  isPlaceholderData: boolean
  /** Search with the search already shown re-reads it. */
  refetch: () => unknown
}

export interface SearchFrameProps {
  /** The list's name: the `data-search-frame` hook, and the boxes' ids. */
  name: string
  /** `useListSearch(spec)`. */
  search: ListSearch
  /** The list's query — `useQuery(listQuery(…, search.state, …))`. */
  read: FrameQuery
  /** A filter value's words. */
  filterLabel: (value: string) => string
  /** A sort value's words; needed only when the spec has sorts. */
  sortLabel?: (value: string) => string
  /** Draw the GS1 box (ticket 944). Its value is in `search.boxes.gs1` and the address's `gs1`. */
  gs1?: boolean
  /** The list's own boxes, drawn after the filter and before Search (Takes' day, 942). */
  extraBoxes?: ReactNode
  /** Drawn above the rows once a search ran, before the count (944's scan chips). */
  aboveRows?: ReactNode
  /** The sentence for an answer with no row. */
  empty: string
  /** The rows (a `ListGrid`), drawn only when the answer has some. */
  children: ReactNode
}

/**
 * The search-first list frame (oms 941, BackOffice spec 4157 "Search first"), shared by every list of the console.
 *
 * Boxes (item number or name; batch or vendor batch, optional; [944] GS1), the filter, [Items] the sort, Search and
 * Clear. On opening: "Nothing is read yet", and no call. Search or Enter in any box reads (a scanner's trailing Enter
 * included); empty boxes list the whole view, 25 a page, with the total and a pager. Clear empties the boxes and the
 * list. A refusal says its own sentence instead of rows. The state is the address's (`./search`): a shared link shows
 * the same rows.
 */
export default function SearchFrame({
  name,
  search,
  read,
  filterLabel,
  sortLabel,
  gs1 = false,
  extraBoxes,
  aboveRows,
  empty,
  children,
}: SearchFrameProps) {
  const { t } = useTranslation('stock-console')
  const { spec, state, boxes } = search
  const view = frameView(state, read)
  const total = read.data?.total ?? 0
  const busy = read.isFetching || read.isPlaceholderData

  // The search already shown writes no new address, so it is read again: "busy, try again" can be tried again.
  const run = () => {
    if (!search.search()) void read.refetch()
  }
  const enter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    run()
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" data-search-frame={name} data-search-view={view}>
      <div role="search" aria-label={t('search.label')} className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={boxes.item}
          onChange={(e) => search.setBox('item', e.target.value)}
          onKeyDown={enter}
          placeholder={t('search.item')}
          aria-label={t('search.item')}
          wrapperClassName="w-56"
          data-search-box="item"
        />
        <Input
          value={boxes.batch}
          onChange={(e) => search.setBox('batch', e.target.value)}
          onKeyDown={enter}
          placeholder={t('search.batch')}
          aria-label={t('search.batch')}
          dir="ltr"
          className="w-56 font-mono"
          data-search-box="batch"
        />
        {gs1 && (
          <Input
            value={boxes.gs1}
            onChange={(e) => search.setBox('gs1', e.target.value)}
            onKeyDown={enter}
            placeholder={t('search.gs1')}
            aria-label={t('search.gs1')}
            dir="ltr"
            className="w-64 font-mono"
            data-search-box="gs1"
          />
        )}
        <Select
          value={state.filter}
          onChange={(e) => search.choose({ filter: e.target.value })}
          aria-label={t('search.filter')}
          data-search-filter=""
        >
          {spec.filters.map((f) => (
            <option key={f} value={f}>
              {filterLabel(f)}
            </option>
          ))}
        </Select>
        {spec.sorts && sortLabel && (
          <Select
            value={state.sort}
            onChange={(e) => search.choose({ sort: e.target.value })}
            aria-label={t('search.sort')}
            data-search-sort=""
          >
            {spec.sorts.map((s) => (
              <option key={s} value={s}>
                {sortLabel(s)}
              </option>
            ))}
          </Select>
        )}
        {extraBoxes}
        <Button variant="primary" onClick={run} data-search-run="">
          {t('search.search')}
        </Button>
        <Button variant="text" onClick={search.clear} data-search-clear="">
          {t('search.clear')}
        </Button>
        {view !== 'nothing' && read.isFetching && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>

      {view === 'nothing' && (
        <p className="py-6 text-center text-sm text-muted-foreground" data-nothing-read="">
          {t('search.nothingYet')}
        </p>
      )}
      {view !== 'nothing' && aboveRows}
      {view === 'loading' && <Loading label={t('search.loading')} />}
      {view === 'refused' && <RefusalBanner error={read.error} />}
      {view === 'empty' && (
        <p className="py-6 text-center text-sm text-muted-foreground" data-list-empty={name}>
          {empty}
        </p>
      )}
      {view === 'rows' && (
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs text-muted-foreground" data-list-count={total}>
            <Trans t={t} i18nKey="search.count" count={total} values={{ n: formatFigure(total) }} components={{ n: <Ltr /> }} />
          </span>
          {children}
          {showsPager(total, STOCK_CONSOLE_PAGE_SIZE) && (
            <GridPager
              page={state.page}
              pageSize={STOCK_CONSOLE_PAGE_SIZE}
              totalMatches={total}
              busy={busy}
              onPage={search.goToPage}
            />
          )}
        </div>
      )}
    </section>
  )
}
