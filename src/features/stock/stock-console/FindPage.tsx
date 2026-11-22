import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { X } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { localToday } from '@/core/util/date-window'
import { formatFigure } from '@/core/util/number-format'
import { canOpenStockConsole } from './access'
import { findQuery } from './api'
import ConsoleNav from './ConsoleNav'
import { FIND_LIST, answerShown, findDecision, itemStoresOpen, itemStoresPage, itemStoresParams } from './find'
import { buildFindBatchColumns, buildFindItemColumns, findBatchRowId, findItemRowId } from './find-columns'
import HowRead from './HowRead'
import { HOW_FIND } from './how-sections'
import ItemStoresList from './ItemStoresList'
import ListGrid from './ListGrid'
import SearchFrame from './SearchFrame'
import { useListSearch } from './use-list-search'
import { useScan } from './use-scan'

/**
 * Find an item or a batch (oms 943, BackOffice spec 4157 stories 62–65) — `/stock/console/find`. Read-only.
 *
 * The search-first frame across the fleet, with the GS1 box (944). With a batch: one row per store, item and batch, with
 * the count of rows and of stores; a row opens the item at that store. Without one: items by number or name; an item
 * opens its Other stores view below, kept in the address. Both boxes empty: Search says what to fill and asks nothing.
 */
export default function FindPage() {
  const { t } = useTranslation('stock-console')
  return (
    <ScreenGate can={canOpenStockConsole} ns="stock-console" title={t('title')} subtitle={t('subtitle')}>
      <Find />
    </ScreenGate>
  )
}

function Find() {
  const { t, i18n } = useTranslation('stock-console')
  const search = useListSearch(FIND_LIST)
  const scan = useScan(search)
  // What is asked — a scanned code's item and lot count as the boxes.
  const decision = findDecision(scan.state)
  const read = useQuery(findQuery(scan.state))
  const shown = answerShown(decision, read.data)
  const frame = scan.frame({ ...read, data: shown })
  const fill = decision === 'fill'
  // The reader's local day, taken once while the page is open: the expiry marks compare against it.
  const today = useMemo(() => localToday(), [])

  const batchColumns = useMemo(
    () => buildFindBatchColumns(t, i18n.language, today, scan.answer),
    [t, i18n.language, today, scan.answer],
  )
  const { state } = search
  const itemColumns = useMemo(() => buildFindItemColumns(t, i18n.language, state), [t, i18n.language, state])

  const [, setSearchParams] = useSearchParams()
  const opened = itemStoresOpen(state)

  return (
    <div className="flex min-w-0 flex-col gap-4" data-console-find="">
      <ConsoleNav />
      <p className="text-sm text-muted-foreground">{t('find.lead')}</p>
      <div className="rounded-lg border border-border/60 bg-card p-3">
        <SearchFrame
          name="find"
          search={search}
          {...frame}
          stopped={frame.stopped || fill}
          aboveRows={
            fill ? (
              <p className="py-6 text-center text-sm text-muted-foreground" data-find-fill="">
                {t('find.fill')}
              </p>
            ) : (
              frame.aboveRows
            )
          }
          empty={t(decision === 'batch' ? 'find.empty.batch' : 'find.empty.item')}
          count={
            shown?.kind === 'Batch' ? (
              <span className="inline-flex gap-1" data-find-stores={shown.stores}>
                <Trans t={t} i18nKey="find.rows" count={shown.total} values={{ n: formatFigure(shown.total) }} components={{ n: <Ltr /> }} />
                <Trans
                  t={t}
                  i18nKey="find.atStores"
                  count={shown.stores}
                  values={{ n: formatFigure(shown.stores) }}
                  components={{ n: <Ltr /> }}
                />
              </span>
            ) : undefined
          }
        >
          {shown?.kind === 'Batch' ? (
            <ListGrid rows={shown.rows} columns={batchColumns} rowId={findBatchRowId} name="find-batches" />
          ) : shown?.kind === 'Item' ? (
            <ListGrid rows={shown.rows} columns={itemColumns} rowId={findItemRowId} name="find-items" />
          ) : null}
        </SearchFrame>
      </div>

      {opened && (
        <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" data-find-stores-open={opened}>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">
              <Trans t={t} i18nKey="find.stores.title" values={{ item: opened }} components={{ i: <Ltr /> }} />
            </h3>
            <Link
              to={{ search: `?${itemStoresParams(state, null).toString()}` }}
              className="ms-auto inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
              data-find-stores-close=""
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {t('find.stores.close')}
            </Link>
          </div>
          <ItemStoresList
            key={opened}
            item={opened}
            page={itemStoresPage(state)}
            onPage={(n) => setSearchParams(itemStoresParams(state, opened, n), { replace: true })}
          />
        </section>
      )}

      <HowRead section="find" paragraphs={HOW_FIND} />
    </div>
  )
}
