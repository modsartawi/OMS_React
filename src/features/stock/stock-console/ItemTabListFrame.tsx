import type { ReactNode } from 'react'
import type { ColDef } from 'ag-grid-community'
import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { formatFigure } from '@/core/util/number-format'
import ListGrid from './ListGrid'
import Loading from './Loading'
import RefusalBanner from './RefusalBanner'

/**
 * An item tab's read as the list draws it (a TanStack Query result fits): its rows and the whole match's count — a page
 * (Batches, Takes) or the item's holds (open plus released, `total` = both counts).
 */
export interface ItemTabRead<T> {
  isPending: boolean
  isError: boolean
  error: unknown
  data: { rows: T[]; total: number } | undefined
}

/**
 * One item tab's list (oms 943): read on opening, so no search frame — the first read in flight, its refusal (no kept
 * rows under it), the empty sentence, or the rows. When the answer holds more than the page asked, it says how many are
 * shown of how many.
 */
export default function ItemTabListFrame<T>({
  name,
  read,
  empty,
  columns,
  rowId,
  above,
}: {
  name: string
  read: ItemTabRead<T>
  empty: string
  columns: ColDef<T>[]
  rowId: (row: T) => string
  /** A line above the rows (Takes: failed calls are left out). */
  above?: ReactNode
}) {
  const { t } = useTranslation('stock-console')
  if (read.isError) return <RefusalBanner error={read.error} />
  if (read.isPending || !read.data) return <Loading label={t('itemTabs.loading')} />
  const { rows, total } = read.data
  return (
    <div className="flex min-w-0 flex-col gap-2" data-item-tab-list={name}>
      {above}
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground" data-list-empty={name}>
          {empty}
        </p>
      ) : (
        <>
          {total > rows.length && (
            <span className="text-xs text-muted-foreground" data-item-tab-showing={total}>
              <Trans
                t={t}
                i18nKey="itemTabs.showing"
                values={{ shown: formatFigure(rows.length), total: formatFigure(total) }}
                components={{ n: <Ltr /> }}
              />
            </span>
          )}
          <ListGrid rows={rows} columns={columns} rowId={rowId} name={name} />
        </>
      )}
    </div>
  )
}
