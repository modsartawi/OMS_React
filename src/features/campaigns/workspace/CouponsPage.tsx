import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { Layers, Plus, Search, Ticket, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import type { RuleCampaignCoupon, RuleCouponBatch } from '@/core/models/rule-campaign'
import { ruleCouponsQuery } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { useWorkspace } from './context'
import { couponColumns, type CouponGridContext } from './coupon-columns'
import { COUPON_STATUSES, couponCounts, statusFromParam, visibleCoupons, type CouponStatusFilter } from './coupon-form'
import CreateCouponsDialog from './CreateCouponsDialog'
import { Refusal, SETTINGS_CONTROL } from './settings-ui'

/**
 * The campaign's Coupons (ticket 515; the prototype's `CouponsPage`), in the menu only when the
 * coupons feature is on: every code with its status, uses, validity, member and batch, a search
 * over the code, a status filter and a batch filter. Create coupons opens a dialog for one batch of
 * random, universal or personal codes; on success a modal shows HQ's batch id and the count, and
 * "Show the codes" filters the list to that batch.
 *
 * The search, the status and the batch live in the URL (`?q=&status=&batch=`, replaced), so a
 * reload or a link keeps the list as it was filtered.
 */
export default function CouponsPage() {
  const { t } = useTranslation('campaign-workspace')
  const { campaign: c } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = statusFromParam(params.get('status'))
  const batch = params.get('batch') ?? ''
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<RuleCouponBatch | null>(null)

  const set = (change: { q?: string; status?: CouponStatusFilter; batch?: string }) => {
    const next = { q, status, batch, ...change }
    const out = new URLSearchParams()
    if (next.q) out.set('q', next.q)
    if (next.status !== 'all') out.set('status', next.status)
    if (next.batch) out.set('batch', next.batch)
    setParams(out, { replace: true })
  }

  const coupons = useQuery({ ...ruleCouponsQuery(c.id), enabled: c.features.coupons })
  const codes = useMemo(() => coupons.data ?? [], [coupons.data])
  const shown = useMemo(() => visibleCoupons(codes, { q, status, batch }), [codes, q, status, batch])
  const counts = useMemo(() => couponCounts(codes), [codes])
  const taken = useMemo(() => codes.map((k) => k.code.toUpperCase()), [codes])

  const columns = useMemo(() => couponColumns(t), [t])
  const gridContext = useMemo<CouponGridContext>(
    () => ({
      statusLabel: (s) => t(`coupons.status.${s}`),
      onBatch: (b) => set({ batch: b }),
      batchLabel: (b) => t('coupons.batchFilter', { batch: fsi(b) }),
    }),
    // `set` closes over the filters it keeps: a new filter makes a new context for the grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, q, status, batch],
  )

  if (!c.features.coupons) {
    return (
      <section className="flex flex-col gap-4" data-coupons-page="off">
        <Header />
        <p className="rounded-lg border border-border/60 bg-card p-4 text-sm" data-coupons-off="">
          <Trans
            t={t}
            i18nKey="coupons.off"
            components={{ features: <Link to={`${campaignPath(c.id)}/settings/features`} className="font-medium text-primary hover:underline" /> }}
          />
        </p>
      </section>
    )
  }

  const filtered = !!q || status !== 'all' || !!batch

  return (
    <section className="flex flex-col gap-4" data-coupons-page="">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Header>
          {coupons.data && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground" data-coupons-counts="">
              <Trans
                t={t}
                i18nKey="coupons.counts"
                count={codes.length}
                values={{ total: codes.length, ...counts }}
                components={{ total: <Ltr />, unused: <Ltr />, used: <Ltr />, disabled: <Ltr />, expired: <Ltr /> }}
              />
            </p>
          )}
        </Header>
        <Button variant="primary" onClick={() => setCreating(true)} disabled={!coupons.data} data-coupons-create-open="">
          <Plus className="size-3.5" aria-hidden />
          {t('coupons.create.open')}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3" data-coupons-filters="">
        <label className="flex min-w-60 flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('coupons.search.label')}
          <span className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" aria-hidden />
            <input
              type="search"
              dir="ltr"
              value={q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder={t('coupons.search.placeholder')}
              className="h-9 w-full rounded-md border border-border/60 bg-background ps-8 pe-2.5 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none"
              data-coupons-search=""
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('coupons.statusFilter')}
          <select value={status} onChange={(e) => set({ status: e.target.value as CouponStatusFilter })} className={SETTINGS_CONTROL} data-coupons-status="">
            <option value="all">{t('coupons.anyStatus')}</option>
            {COUPON_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`coupons.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {batch && (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary-border bg-primary-050 ps-3 pe-1 text-sm text-primary-800" data-coupons-batch-chip={batch}>
            <Layers className="h-3.5 w-3.5" aria-hidden />
            <span>
              <Trans t={t} i18nKey="coupons.batchChip" values={{ batch }} components={{ batch: <bdi dir="ltr" className="font-mono" /> }} />
            </span>
            <button
              type="button"
              className="rounded-full p-1 hover:bg-accent"
              onClick={() => set({ batch: '' })}
              aria-label={t('coupons.clearBatch')}
              title={t('coupons.clearBatch')}
              data-coupons-batch-clear=""
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </span>
        )}
        {filtered && (
          <Button variant="text" onClick={() => setParams(new URLSearchParams(), { replace: true })} data-coupons-clear="">
            {t('coupons.clearFilters')}
          </Button>
        )}
      </div>

      {coupons.isError && (
        <div data-coupons-refusal="">
          <Refusal title={t('coupons.failedTitle')} fallback={t('coupons.failed')} error={coupons.error} />
          <Button variant="outlined" className="mt-2" onClick={() => void coupons.refetch()} disabled={coupons.isFetching} data-coupons-retry="">
            {t('coupons.retry')}
          </Button>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-22rem)] min-h-80" data-coupons-grid="">
          <AgGridReact<RuleCampaignCoupon>
            theme={omsGridTheme}
            // A failed re-read keeps the codes last read on screen, under its refusal.
            rowData={shown}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.code}
            context={gridContext}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            suppressColumnVirtualisation
            loading={coupons.isPending}
            noRowsOverlayComponent={NoRows}
            noRowsOverlayComponentParams={{ any: codes.length > 0 }}
            suppressNoRowsOverlay={coupons.isError && !coupons.data}
          />
        </div>
        {coupons.data && (
          <div
            className="flex h-7 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
            data-coupons-status-bar=""
          >
            <span data-coupons-shown="">
              <Trans t={t} i18nKey="coupons.shown" count={codes.length} values={{ n: shown.length, total: codes.length }} components={{ n: <Ltr />, total: <Ltr /> }} />
            </span>
          </div>
        )}
      </div>

      <CreateCouponsDialog
        key={c.id}
        campaign={c}
        taken={taken}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(b) => {
          setCreating(false)
          setCreated(b)
        }}
      />
      {created && (
        <Modal
          open
          onClose={() => setCreated(null)}
          title={t('coupons.created.title')}
          width="30rem"
          footer={
            <>
              <Button
                variant="text"
                onClick={() => {
                  setCreated(null)
                  setCreating(true)
                }}
                data-coupons-created-more=""
              >
                {t('coupons.created.more')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setParams(new URLSearchParams({ batch: created.batch }), { replace: true })
                  setCreated(null)
                }}
                data-coupons-created-show=""
              >
                {t('coupons.created.show')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3" data-coupons-created={created.batch}>
            <p className="text-sm">
              <Trans t={t} i18nKey="coupons.created.body" count={created.count} values={{ n: created.count }} components={{ n: <Ltr /> }} />
            </p>
            <p className="rounded-md border border-border/60 bg-muted px-3 py-2 text-center font-mono text-lg font-semibold tracking-wide" data-batch-id="">
              <Ltr>{created.batch}</Ltr>
            </p>
            <p className="text-sm text-muted-foreground">{t('coupons.created.hint')}</p>
          </div>
        </Modal>
      )}
    </section>
  )
}

function Header({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <header>
      <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Ticket className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('coupons.title')}
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('coupons.intro')}</p>
      {children}
    </header>
  )
}

/** The empty grid: none yet, or none matching the filters. */
function NoRows({ any }: { any: boolean }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <span className="text-sm text-muted-foreground" data-coupons-none="">
      {t(any ? 'coupons.noMatch' : 'coupons.none')}
    </span>
  )
}

const DEFAULT_COL_DEF: ColDef<RuleCampaignCoupon> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}
