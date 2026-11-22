import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, SearchX } from 'lucide-react'
import { apiErrorCode } from '@/core/api'
import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenStockConsole } from './access'
import { storeHeaderQuery } from './api'
import ConsoleNav from './ConsoleNav'
import { STOCK_CONSOLE_PATH } from './console-pages'
import Loading from './Loading'
import RefusalBanner from './RefusalBanner'
import StoreHeader from './StoreHeader'
import StoreTabs from './StoreTabs'

/**
 * One store on the stock console (oms 941, BackOffice spec 4157) — `/stock/console/store/:store`. Read-only.
 *
 * Opening reads the header only (`StockConsole/Stores/{store}`, fresh). The tabs below read nothing until asked: each
 * list opens on "Nothing is read yet" (the search-first rule). An unknown store says so (`NoStore`); any other failure
 * says its own sentence.
 */
export default function StorePage() {
  const { t } = useTranslation('stock-console')
  return (
    <ScreenGate can={canOpenStockConsole} ns="stock-console" title={t('title')} subtitle={t('subtitle')}>
      <Store />
    </ScreenGate>
  )
}

function Store() {
  const { t } = useTranslation('stock-console')
  const { store = '' } = useParams()
  const header = useQuery(storeHeaderQuery(store))
  const noStore = header.isError && apiErrorCode(header.error) === 'NoStore'
  // A failed read draws no kept header: an old one beside the error would pass for the store now.
  const row = header.isError ? undefined : header.data

  return (
    <div className="flex min-w-0 flex-col gap-4" data-console-store={store}>
      <ConsoleNav />
      <Link
        to={STOCK_CONSOLE_PATH}
        className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('store.back')}
      </Link>

      {header.isPending && <Loading label={t('store.loading')} />}

      {noStore && (
        <div
          className="mx-auto mt-8 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
          role="alert"
          data-no-store=""
        >
          <SearchX className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
          <div className="text-base font-semibold tracking-tight">{t('store.noStoreTitle')}</div>
          <p className="mt-2 text-sm text-muted-foreground">{t('store.noStoreHint')}</p>
        </div>
      )}

      {header.isError && !noStore && <RefusalBanner error={header.error} />}

      {row && <StoreHeader row={row} />}
      {/* Keyed on the store, so a link to another store starts every tab afresh. Drawn once the store is known, so an
          unknown store asks no list. */}
      {!noStore && (row || header.isError) && <StoreTabs key={store} store={store} />}
    </div>
  )
}
