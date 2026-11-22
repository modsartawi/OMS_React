import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, SearchX } from 'lucide-react'
import { apiErrorCode } from '@/core/api'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatDateTime } from '@/core/util/date-format'
import { localizedName } from '@/core/util/localized-name'
import { canOpenStockConsole } from './access'
import { itemHeaderQuery } from './api'
import ConsoleNav from './ConsoleNav'
import { FIND_PATH, storeHref } from './console-pages'
import ItemSum from './ItemSum'
import ItemTabStrip from './ItemTabStrip'
import Loading from './Loading'
import RefusalBanner from './RefusalBanner'

/**
 * One item at one store on the stock console (oms 943, BackOffice spec 4157 stories 52–60) —
 * `/stock/console/store/:store/item/:item`. Read-only.
 *
 * Opening reads the item's figures (`StockConsole/Stores/{store}/Items/{item}`) and writes its sum out; the tabs below
 * are each one small read on opening. An item with no stock row at the store says so (`NoRow`).
 */
export default function ItemPage() {
  const { t } = useTranslation('stock-console')
  return (
    <ScreenGate can={canOpenStockConsole} ns="stock-console" title={t('title')} subtitle={t('subtitle')}>
      <Item />
    </ScreenGate>
  )
}

function Item() {
  const { t, i18n } = useTranslation('stock-console')
  const { store = '', item = '' } = useParams()
  const header = useQuery(itemHeaderQuery(store, item))
  const noRow = header.isError && apiErrorCode(header.error) === 'NoRow'
  // A failed read draws no kept figures: an old sum beside the error would pass for the item now.
  const row = header.isError ? undefined : header.data
  const name = row ? localizedName(row, i18n.language) : ''

  return (
    <div className="flex min-w-0 flex-col gap-4" data-console-item={item} data-console-store={store}>
      <ConsoleNav />
      <Link
        to={storeHref(store)}
        className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
        data-item-back={store}
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        <Trans t={t} i18nKey="item.back" values={{ store }} components={{ s: <Ltr /> }} />
      </Link>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-mono text-2xl">
          <Ltr>{item}</Ltr>
        </h2>
        {name && (
          <span className="text-base font-medium">
            <bdi>{name}</bdi>
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          <Trans t={t} i18nKey="item.atStore" values={{ store }} components={{ s: <Ltr /> }} />
        </span>
        {row && (
          <span className="text-xs text-muted-foreground">
            <Trans
              t={t}
              i18nKey="item.lastUpdate"
              values={{ at: row.lastUpdate ? formatDateTime(row.lastUpdate) : t('store.never') }}
              components={{ at: <Ltr /> }}
            />
          </span>
        )}
        <span className="ms-auto text-xs text-muted-foreground">{t('stores.baseUnits')}</span>
      </div>

      {header.isPending && <Loading label={t('item.loading')} />}

      {noRow && (
        <div
          className="mx-auto mt-8 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
          role="alert"
          data-no-row=""
        >
          <SearchX className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
          <div className="text-base font-semibold tracking-tight">{t('item.noRowTitle')}</div>
          <p className="mt-2 text-sm text-muted-foreground">{t('item.noRowHint')}</p>
          <Link to={FIND_PATH} className="mt-3 inline-block text-sm text-primary underline-offset-2 hover:underline">
            {t('nav.find')}
          </Link>
        </div>
      )}

      {header.isError && !noRow && <RefusalBanner error={header.error} />}

      {row && <ItemSum item={row} />}
      {/* Keyed on the store and the item, so a link to another starts every tab afresh. Drawn once the item is known, so
          an item with no row here asks no tab. */}
      {!noRow && (row || header.isError) && <ItemTabStrip key={`${store}\u0000${item}`} store={store} item={item} />}
    </div>
  )
}
