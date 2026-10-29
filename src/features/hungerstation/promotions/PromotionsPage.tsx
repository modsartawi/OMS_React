import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import { hungerStationAccessQuery, hungerStationChainsQuery } from '@/core/hungerstation/api'
import { canManagePromotions, canManageStores } from '@/core/hungerstation/access'
import { useSeenChains } from '@/core/hungerstation/seen-chains'
import type { HungerStationPromotionRow, HungerStationPromotionStatus, HungerStationPromotionType } from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatRange, fsi } from '@/core/util/bidi'
import { keyChoices, toggled } from '@/core/util/filter-choices'
import { formatFigure as figure } from '@/core/util/number-format'
import { PROMOTIONS_KEY, promotionsApi } from './api'
import { promotionColumns } from './columns'
import PromotionSheet from './PromotionSheet'
import { PROMOTION_STATUSES } from './promotion-status'
import { PROMOTION_TYPES, promotionsDoorParams, promotionsFromParams, promotionsToParams, type PromotionsPageQuery } from './promotions-query'

/**
 * HungerStation promotions (ticket 665, BackOffice spec 3201) — slice 0: the list and the
 * read-only detail. A **HungerStation promotion** is made here and SENT to HungerStation; our
 * pricing never applies it (ADR 0114). The list is server-paged and filtered by chain, status,
 * type and name, all in the URL; `?promotion=<id>` opens one promotion's detail (header, parts,
 * stores, items, every send), so a pasted link opens it.
 *
 * Behind `canManagePromotions` on the ONE HungerStation probe, the same predicate the menu leaf
 * reads. 🚩 The doors are not built (BackOffice 3211): proven against stubs only.
 */
export default function PromotionsPage() {
  const { t } = useTranslation('hungerstation-promotions')
  return (
    <ScreenGate query={hungerStationAccessQuery()} can={canManagePromotions} ns="hungerstation-promotions" title={t('title')} subtitle={t('subtitle')}>
      <Promotions />
    </ScreenGate>
  )
}

type Row = HungerStationPromotionRow

const DEFAULT_COL_DEF: ColDef<Row> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

function Promotions() {
  const { t } = useTranslation('hungerstation-promotions')
  // 🔑 The URL is the query — filters, page and the open promotion.
  const { query, update: change } = useUrlQuery(promotionsFromParams, promotionsToParams)

  const [text, setText] = useState(query.q ?? '')
  useEffect(() => setText(query.q ?? ''), [query.q])

  // A filter change takes the name box as it reads, and starts again at the first page.
  const update = (patch: Partial<PromotionsPageQuery>) => change((prev) => ({ ...prev, q: text.trim() || null, skip: 0, ...patch }))
  const open = (promotion: string | null) => change((prev) => ({ ...prev, promotion }))

  const door = promotionsDoorParams(query)
  const promotions = useQuery({
    queryKey: [...PROMOTIONS_KEY, 'list', promotionsToParams({ ...query, promotion: null }).toString()],
    queryFn: () => promotionsApi.list(door),
    placeholderData: keepPreviousData,
    retry: false,
  })
  // Rows only from an answer to THIS query: never after a failed read, or while the previous page
  // stands in for the next one.
  const current = !promotions.isError && !promotions.isPlaceholderData
  const rows = useMemo(() => (current ? (promotions.data?.rows ?? []) : []), [promotions.data, current])
  const total = current ? (promotions.data?.total ?? 0) : 0

  // 🚩 The `Chains` read rides `canManageStores` (spec 3028 contract § Access), which a promotions
  // user may lack — then it is never sent, and the filter offers the chains seen on the rows.
  const access = useQuery(hungerStationAccessQuery())
  const manageStores = canManageStores(access.data)
  const chains = useQuery({ ...hungerStationChainsQuery(), enabled: manageStores })
  const seen = useSeenChains(rows)
  const chainKeys = keyChoices(manageStores && chains.isSuccess ? chains.data : undefined, seen, [query.chain])

  const columns = useMemo(
    () => promotionColumns(t, { onDetails: (row) => change((prev) => ({ ...prev, promotion: row.promotionId })) }),
    [t, change],
  )

  const loading = promotions.isFetching && (!promotions.data || promotions.isPlaceholderData)
  const pageEnd = query.skip + rows.length

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if ((text.trim() || null) === query.q && query.skip === 0) void promotions.refetch()
          else update({})
        }}
        data-promotions-filters=""
      >
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('filters.chain')}>
            <Select value={query.chain ?? ''} onChange={(e) => update({ chain: e.target.value || null })} data-filter-chain="">
              <option value="">{t('filters.chainAll')}</option>
              {chainKeys.map((c) => (
                <option key={c} value={c}>
                  {fsi(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('filters.type')}>
            <Select
              value={query.type ?? ''}
              onChange={(e) => update({ type: (e.target.value || null) as HungerStationPromotionType | null })}
              data-filter-type=""
            >
              <option value="">{t('filters.typeAll')}</option>
              {PROMOTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`types.${type}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('filters.q')} className="min-w-[18rem] flex-1">
            <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('filters.qPlaceholder')} data-filter-q="" />
          </Field>
          <Button type="submit" disabled={promotions.isFetching} data-promotions-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('filters.search')}
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setText('')
              change(() => promotionsFromParams(new URLSearchParams()))
            }}
            data-promotions-clear=""
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('filters.clear')}
          </Button>
        </div>

        <div role="group" aria-label={t('filters.status')} className="flex flex-wrap items-center gap-1.5" data-filter-statuses="">
          <span className="text-xs font-medium text-muted-foreground">{t('filters.status')}</span>
          {PROMOTION_STATUSES.map((s) => (
            <Chip
              key={s}
              on={query.status.includes(s)}
              onClick={() => update({ status: toggled<HungerStationPromotionStatus>(query.status, s) })}
              data-filter-status={s}
            >
              {t(`statuses.${s}`)}
            </Chip>
          ))}
        </div>
      </form>

      {promotions.isError && (
        <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(promotions.error, t('results.failed'))} />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-22rem)] min-h-96" data-promotions-grid="">
          <AgGridReact<Row>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.promotionId}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            suppressColumnVirtualisation
            loading={loading}
            noRowsOverlayComponent={NoRows}
            suppressNoRowsOverlay={promotions.isError}
          />
        </div>
        <div
          className="flex h-8 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
          data-status-bar=""
        >
          {loading ? (
            <span>{t('results.loading')}</span>
          ) : total > rows.length ? (
            <span data-status-count="">
              <Trans
                t={t}
                i18nKey="results.page"
                values={{ range: formatRange(figure(query.skip + 1), figure(pageEnd)), total: figure(total) }}
                components={{ range: <Ltr />, total: <Ltr /> }}
              />
            </span>
          ) : (
            <span data-status-count="">
              <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: figure(rows.length) }} components={{ n: <Ltr /> }} />
            </span>
          )}
          {total > rows.length && (
            <span className="flex items-center gap-1">
              <Button
                variant="ghost"
                disabled={query.skip === 0 || promotions.isFetching}
                onClick={() => change((prev) => ({ ...prev, skip: Math.max(0, prev.skip - prev.take) }))}
                data-promotions-previous=""
              >
                {/* The arrow points back along the reading direction. */}
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                {t('results.previous')}
              </Button>
              <Button
                variant="ghost"
                disabled={pageEnd >= total || promotions.isFetching}
                onClick={() => change((prev) => ({ ...prev, skip: prev.skip + prev.take }))}
                data-promotions-next=""
              >
                {t('results.next')}
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              </Button>
            </span>
          )}
        </div>
      </div>

      {query.promotion && <PromotionSheet key={query.promotion} promotionId={query.promotion} onClose={() => open(null)} />}
    </div>
  )
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('hungerstation-promotions')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
