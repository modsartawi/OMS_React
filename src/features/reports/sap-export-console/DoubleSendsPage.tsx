import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import { ArrowLeft, Loader2 } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { canOpenSapExport, sapExportAccessQuery } from './access'
import { doubleSendsQuery } from './api'
import { DOUBLE_SEND_DEFAULT_COL_DEF, buildDoubleSendColumns } from './double-send-columns'
import {
  DEFAULT_DOUBLE_SEND_QUERY,
  DOUBLE_SEND_FLAG_OPTIONS,
  DOUBLE_SEND_PAGE_SIZE,
  doubleSendErrorKey,
  doubleSendQueryFromParams,
  doubleSendQueryToParams,
  doubleSendRows,
  isFilteredDoubleSends,
  withDoubleSendFilter,
  type DoubleSendView,
} from './double-send-helpers'
import type { DoubleSendFlag } from './fleet-helpers'
import { figure } from './storeday-helpers'
import Button from '@/core/ui/Button'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'

/**
 * The double-send list — `/reports/sap-export/double-sends?code=&flag=X1|X1p&page=` (BackOffice spec
 * 2579, ticket 465), from `GET SapExport/DoubleSends`. Every transaction sent on both rails, the
 * ones that can still be stopped (X1p) first and in red; filtered by flag and store, paged at 50,
 * each row linking to its store, its store-day and the IDoc inspector. The fleet's double-send
 * tiles (463) open it with their flag.
 *
 * 🚩 **Read-only.** It shows double sends; asking SAP for a reversal or stopping a send is out of
 * scope (spec 2579, resets).
 */
export default function DoubleSendsPage() {
  const { t } = useTranslation('sap-export-console')
  return (
    <ScreenGate query={sapExportAccessQuery()} can={canOpenSapExport} ns="sap-export-console" title={t('title')} subtitle={t('subtitle')}>
      <DoubleSends />
    </ScreenGate>
  )
}

function DoubleSends() {
  const { t } = useTranslation('sap-export-console')
  // 🔑 The filters and the page are the URL's (`./double-send-helpers`): a view is a link.
  const { query, update, changedFromOutside } = useUrlQuery(doubleSendQueryFromParams, doubleSendQueryToParams)

  // The store box is a draft applied on submit — a store code is an exact match, and asking on every
  // keystroke would answer "no such store" to each half-typed code. A change from outside resets it.
  const [draft, setDraft] = useState(query.code)
  useEffect(() => {
    if (changedFromOutside()) setDraft((d) => (d.trim() === query.code ? d : query.code))
  }, [query.code, changedFromOutside])

  const list = useQuery(doubleSendsQuery(query))
  const columns = useMemo(() => buildDoubleSendColumns(t), [t])

  // 🚩 A failed read draws no rows: the kept previous answer belongs to the query before it.
  const shown = list.isError ? undefined : list.data
  const rows = useMemo(() => (shown ? doubleSendRows(shown.items) : []), [shown])
  const total = shown?.total ?? 0

  // A later read can shrink the list under an inner page; an emptied page falls back to the last.
  const settled = shown && !list.isPlaceholderData ? shown : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: DOUBLE_SEND_PAGE_SIZE,
    })
    if (last !== settled.page) update((q) => (q.page === settled.page ? { ...q, page: last } : q))
  }, [settled, update])

  const errorKey = list.isError ? doubleSendErrorKey(apiErrorCode(list.error)) : null
  const filtered = isFilteredDoubleSends(query)

  return (
    <div className="flex min-w-0 flex-col gap-4" data-double-sends-page={query.flag ?? ''}>
      <Link to="/reports/sap-export" className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('doubleSends.back')}
      </Link>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{t('doubleSends.heading')}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('doubleSends.intro')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-double-sends-filters="">
        <Select
          value={query.flag ?? ''}
          // The flag alone changes: a half-typed store code is not a filter until it is submitted.
          // The box drops it, so the box never shows a store the list is not filtered on.
          onChange={(e) => {
            update((q) => withDoubleSendFilter(q, { flag: (e.target.value || null) as DoubleSendFlag | null }))
            setDraft(query.code)
          }}
          aria-label={t('doubleSends.flag')}
          data-double-sends-flag=""
        >
          <option value="">{t('doubleSends.flagBoth')}</option>
          {DOUBLE_SEND_FLAG_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {t(`flags.${f}`)}
            </option>
          ))}
        </Select>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            update((q) => withDoubleSendFilter(q, { code: draft }))
          }}
        >
          <Input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('doubleSends.storePlaceholder')}
            aria-label={t('doubleSends.store')}
            wrapperClassName="w-40 font-mono"
            data-double-sends-store=""
          />
          <Button type="submit" variant="outlined" data-double-sends-apply="">
            {t('doubleSends.apply')}
          </Button>
        </form>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setDraft('')
              update(() => DEFAULT_DOUBLE_SEND_QUERY)
            }}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            data-clear-filters=""
          >
            {t('doubleSends.clear')}
          </button>
        )}
        {shown && (
          <span className="text-xs text-muted-foreground" data-double-sends-count={total}>
            <Trans t={t} i18nKey="doubleSends.count" count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
          </span>
        )}
        {list.isPlaceholderData && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status" data-double-sends-refreshing="">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('doubleSends.refreshing')}
          </span>
        )}
      </div>

      {list.isError && <ErrorBanner className="p-3" message={errorKey ? t(errorKey) : apiErrorMessage(list.error, t('doubleSends.failed'))} />}

      {list.isPending ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('doubleSends.loading')}
        </div>
      ) : (
        shown && (
          <div className="overflow-hidden rounded-md border border-border/60">
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground" data-double-sends-empty="">
                {t(query.page > 1 ? 'doubleSends.emptyPage' : filtered ? 'doubleSends.emptyFiltered' : 'doubleSends.empty')}
              </p>
            ) : (
              <div data-double-sends-grid="">
                <AgGridReact<DoubleSendView>
                  theme={omsGridTheme}
                  rowData={rows}
                  columnDefs={columns}
                  defaultColDef={DOUBLE_SEND_DEFAULT_COL_DEF}
                  rowHeight={OMS_GRID_ROW_HEIGHT}
                  headerHeight={OMS_GRID_HEADER_HEIGHT}
                  domLayout="autoHeight"
                  animateRows={false}
                  suppressColumnVirtualisation
                />
              </div>
            )}
          </div>
        )
      )}

      {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
      {((shown && showsPager(total, DOUBLE_SEND_PAGE_SIZE)) || query.page > 1) && (
        <div className="overflow-hidden rounded-md border border-border/60">
          <GridPager
            page={query.page}
            pageSize={DOUBLE_SEND_PAGE_SIZE}
            // A failed inner page has no total; read as the last page, Previous is the way back.
            totalMatches={shown ? total : query.page * DOUBLE_SEND_PAGE_SIZE}
            busy={list.isPlaceholderData}
            onPage={(page) => update((q) => ({ ...q, page: Math.max(1, page) }))}
          />
        </div>
      )}
    </div>
  )
}
