import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Loader2, RefreshCw } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { StockConsoleStoreRow } from '@/core/models/stock-console'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { canOpenStockConsole } from './access'
import { storesQuery } from './api'
import { CONSOLE_COL_DEF } from './columns'
import ConsoleNav from './ConsoleNav'
import HowRead from './HowRead'
import Loading from './Loading'
import StoreTiles from './StoreTiles'
import { buildStoresColumns } from './stores-columns'
import { STORE_SORTS, storesFromParams, storesToParams, tileCounts, visibleStores, type StoreSort } from './stores'

/**
 * The stock console's Stores page (oms 940, BackOffice spec 4157) — `/stock/console`. Read-only.
 *
 * Reads `StockConsole/Stores` once on opening (SIS.Api's copy, at most a minute old) — the only list the console reads
 * without being asked. The list comes whole, so the tiles, the search and the sort run in the browser, and sit in the
 * address so a shared link opens the same view. Refresh reads it again. A row's store code opens its page (941).
 */
export default function StockConsolePage() {
  const { t } = useTranslation('stock-console')
  return (
    <ScreenGate can={canOpenStockConsole} ns="stock-console" title={t('title')} subtitle={t('subtitle')}>
      <Stores />
    </ScreenGate>
  )
}

const HOW_STORES = ['p1', 'p2', 'p3', 'p4', 'p5'] as const

function Stores() {
  const { t } = useTranslation('stock-console')
  const read = useQuery(storesQuery())
  const { query, update, changedFromOutside } = useUrlQuery(storesFromParams, storesToParams)

  // The search box is a draft: what is typed filters as it is typed, and Back or a pasted link resets it.
  const [search, setSearch] = useState(query.q)
  useEffect(() => {
    if (changedFromOutside()) setSearch(query.q)
  }, [query.q, changedFromOutside])

  const columns = useMemo(() => buildStoresColumns(t), [t])
  // 🚩 A failed read draws no rows: a kept earlier answer would pass for the fleet now.
  const data = read.isError ? undefined : read.data
  const all = useMemo(() => data?.stores ?? [], [data])
  const counts = useMemo(() => (data ? tileCounts(all) : undefined), [data, all])
  const rows = useMemo(() => visibleStores(all, query), [all, query])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ConsoleNav />

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" data-read-at="">
        <span className="me-auto">{t('stores.baseUnits')}</span>
        {read.isFetching && (
          <span className="inline-flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('stores.refreshing')}
          </span>
        )}
        {data?.readAt && (
          <span>
            <Trans t={t} i18nKey="stores.readAt" values={{ at: formatDateTime(data.readAt) }} components={{ at: <Ltr /> }} />
          </span>
        )}
        <Button variant="outlined" onClick={() => void read.refetch()} disabled={read.isFetching} data-stores-refresh="">
          <RefreshCw className={'h-3.5 w-3.5 ' + (read.isFetching ? 'animate-spin' : '')} aria-hidden />
          {t('stores.refresh')}
        </Button>
      </div>

      <StoreTiles counts={counts} on={query.tile} onPick={(tile) => update((q) => ({ ...q, tile }))} />

      <section className="flex min-w-0 flex-col gap-2" data-stores-table="">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              const q = e.target.value.trim()
              update((prev) => ({ ...prev, q }))
            }}
            placeholder={t('stores.search')}
            aria-label={t('stores.search')}
            wrapperClassName="w-64"
            data-stores-search=""
          />
          <Select
            value={query.sortBy}
            onChange={(e) => update((q) => ({ ...q, sortBy: e.target.value as StoreSort }))}
            aria-label={t('stores.sort')}
            data-stores-sort=""
          >
            {STORE_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`stores.sorts.${s}`)}
              </option>
            ))}
          </Select>
          <Select
            value={query.desc ? 'desc' : 'asc'}
            onChange={(e) => update((q) => ({ ...q, desc: e.target.value === 'desc' }))}
            aria-label={t('stores.direction')}
            data-stores-direction=""
          >
            <option value="asc">{t('stores.ascending')}</option>
            <option value="desc">{t('stores.descending')}</option>
          </Select>
          {data && (
            <span className="text-xs text-muted-foreground" data-stores-count={rows.length}>
              <Trans
                t={t}
                i18nKey="stores.count"
                count={rows.length}
                values={{ n: formatFigure(rows.length) }}
                components={{ n: <Ltr /> }}
              />
            </span>
          )}
        </div>

        {read.isError && <ErrorBanner className="p-3" message={apiErrorMessage(read.error, t('stores.failed'))} />}

        {read.isPending ? (
          <Loading label={t('stores.loading')} />
        ) : (
          data && (
            <div className="overflow-hidden rounded-md border border-border/60">
              {rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground" data-stores-empty="">
                  {t('stores.empty')}
                </p>
              ) : (
                <div className="h-[32rem]">
                  <AgGridReact<StockConsoleStoreRow>
                    theme={omsGridTheme}
                    rowData={rows}
                    columnDefs={columns}
                    defaultColDef={CONSOLE_COL_DEF}
                    getRowId={({ data: row }) => row.plant}
                    rowHeight={OMS_GRID_ROW_HEIGHT}
                    headerHeight={OMS_GRID_HEADER_HEIGHT}
                    animateRows={false}
                    suppressColumnVirtualisation
                  />
                </div>
              )}
            </div>
          )
        )}
      </section>

      <HowRead section="stores" paragraphs={HOW_STORES} />
    </div>
  )
}
