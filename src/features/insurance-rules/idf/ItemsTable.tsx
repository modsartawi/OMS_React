import { useEffect, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { DeniedCard, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import { formatFigure } from '@/core/util/number-format'
import { emptiedPageTarget } from './paging' // 3185 review
import { itemDescription, typedItemsFilter, withItemsFilter, type IdfEntriesPage, type IdfEntryRow, type IdfItemsQuery } from './items'

export interface ItemsTableProps {
  /** The page read, or undefined while the first one loads. */
  page: IdfEntriesPage | undefined
  /** The read's error, if it failed (a bare 403 draws "no access"). */
  error?: unknown
  query: IdfItemsQuery
  /** A change of the items query, as an updater over the latest one (the caller merges it into its own address). */
  onQuery: (change: (q: IdfItemsQuery) => IdfItemsQuery) => void
  /** A next page is in flight. */
  busy: boolean
  /** 645 · a mark column (the draft's diff); omitted, no column. */
  mark?: (row: IdfEntryRow) => ReactNode
  /** 648 · a row's actions (Edit / Clear); omitted, no column. */
  actions?: (row: IdfEntryRow) => ReactNode
  /** 645 · rows a draft removes, drawn struck through after the page's rows. */
  removed?: IdfEntryRow[]
  /** 647 · what an unfiltered empty table says (default `items.empty`, "This version holds no items."). */
  empty?: string
}

/**
 * A ranking's items as a table (BackOffice spec 3185; oms ticket 643, reused by 647's General page and 645's draft):
 * an item search (number or description) and a group filter, typed and applied on leaving the box, then item,
 * description (reader's language), IDF group and priority, a page at a time. Item, group and priority are machine
 * values (`Ltr`); the description free text (`bdi`). The caller reads the page and owns the address.
 */
export default function ItemsTable({ page, error, query, onQuery, busy, mark, actions, removed, empty }: ItemsTableProps) {
  const { t } = useTranslation('insurance-idf')
  const filtered = query.q !== '' || query.idf !== ''
  // 3185 review: clearing (or removing) the last row of the last page falls back to the new last page, never an empty
  // one. A page read for another page than the address asks (a held placeholder) is never acted on.
  const clampTo = page && !error ? emptiedPageTarget(page, query.page) : null
  useEffect(() => {
    if (clampTo !== null) onQuery((q) => ({ ...q, page: clampTo }))
    // `onQuery` is the caller's inline updater; the clamp is keyed on its target alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampTo])
  return (
    <div className="flex flex-col gap-2">
      <ItemsFilter query={query} onQuery={onQuery} />
      {error && isBareDenial(error) ? (
        <DeniedCard ns="insurance-idf" hook="idf-items-denied" />
      ) : error ? (
        <div data-idf-items-failed="">
          <ErrorBanner message={apiErrorMessage(error, t('items.failed'))} />
        </div>
      ) : !page || clampTo !== null ? (
        <Loading text={t('items.loading')} />
      ) : page.rows.length === 0 && !removed?.length ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-idf-items-empty={filtered ? 'noMatch' : 'empty'}>
          {filtered ? t('items.noMatch') : (empty ?? t('items.empty'))}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" data-idf-items-total="">
            <Trans t={t} i18nKey="items.total" values={{ total: formatFigure(page.total) }} components={{ v: <Ltr /> }} />
          </p>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm" data-idf-items="">
              <thead className="bg-muted/50">
                <tr>
                  {mark && <th className={TH}>{t('items.columns.mark')}</th>}
                  <th className={TH}>{t('items.columns.item')}</th>
                  <th className={TH}>{t('items.columns.description')}</th>
                  <th className={TH}>{t('items.columns.group')}</th>
                  <th className={`${TH} text-end`}>{t('items.columns.priority')}</th>
                  {actions && <th className={TH}>{t('items.columns.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {page.rows.map((r) => (
                  <ItemRow key={r.itemNumber} row={r} mark={mark} actions={actions} />
                ))}
                {removed?.map((r) => (
                  <ItemRow key={`removed-${r.itemNumber}`} row={r} mark={mark} removed />
                ))}
              </tbody>
            </table>
            {showsPager(page.total, page.pageSize) && (
              <GridPager page={query.page} pageSize={page.pageSize} totalMatches={page.total} busy={busy} onPage={(n) => onQuery((q) => ({ ...q, page: n }))} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ItemRow({ row, mark, actions, removed = false }: { row: IdfEntryRow; mark?: ItemsTableProps['mark']; actions?: ItemsTableProps['actions']; removed?: boolean }) {
  const { i18n } = useTranslation('insurance-idf')
  const description = itemDescription(row, i18n.language)
  return (
    <tr
      className={`border-t border-border/60 ${removed ? 'text-muted-foreground line-through' : ''}`}
      data-item={row.itemNumber}
      data-idf={row.idfNumber}
      data-priority={row.priority}
      {...(removed ? { 'data-removed': '' } : {})}
    >
      {mark && (
        <td className={TD} data-col="mark">
          {mark(row)}
        </td>
      )}
      <td className={TD} data-col="item">
        <Ltr>{row.itemNumber}</Ltr>
      </td>
      <td className={TD} data-col="description">
        {description && <bdi>{description}</bdi>}
      </td>
      <td className={TD} data-col="group">
        <Ltr>{row.idfNumber}</Ltr>
      </td>
      <td className={NUM} data-col="priority">
        <Ltr>{formatFigure(row.priority)}</Ltr>
      </td>
      {actions && (
        <td className={TD} data-col="actions">
          {!removed && actions(row)}
        </td>
      )}
    </tr>
  )
}

/**
 * Search and group are typed: they apply on leaving the box, and Enter leaves it — one write path. Only a real change
 * applies (an untouched box keeps the page). Keyed on the address so Back resets them.
 */
function ItemsFilter({ query, onQuery }: Pick<ItemsTableProps, 'query' | 'onQuery'>) {
  const { t } = useTranslation('insurance-idf')
  const typed = (field: 'q' | 'idf') => ({
    key: `${field}:${query[field]}`,
    defaultValue: query[field],
    placeholder: t(field === 'q' ? 'items.searchPlaceholder' : 'items.groupPlaceholder'),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const patch = typedItemsFilter(query, field, e.target.value)
      if (patch) onQuery((q) => withItemsFilter(q, patch))
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.currentTarget.blur(),
    'data-filter': field,
  })
  const { key: qKey, ...qProps } = typed('q')
  const { key: idfKey, ...idfProps } = typed('idf')
  return (
    <fieldset className="flex flex-wrap items-end gap-2" data-idf-items-filter="">
      <legend className="sr-only">{t('items.title')}</legend>
      <Field label={t('items.search')}>
        <Input key={qKey} {...qProps} className="w-64" />
      </Field>
      <Field label={t('items.group')}>
        <Input key={idfKey} {...idfProps} className="w-40" dir="ltr" />
      </Field>
    </fieldset>
  )
}
