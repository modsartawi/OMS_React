import { useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, RowClickedEvent } from 'ag-grid-community'
import { Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import type { RuleCampaignListRow } from '@/core/models/rule-campaign'
import { ruleCampaignsQuery } from '@/core/rules/api'
import { CAMPAIGN_STATES, CAMPAIGN_STATE_SEV, campaignPath } from '@/core/rules/campaign-state'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import type { Severity } from '@/core/ui/severity'
import { campaignColumns } from './columns'
import { stateCounts, tileFromParam, visibleRows, type StateTile } from './list-filter'

/**
 * Campaigns (ticket 501, BackOffice spec 2737): every rule campaign, with a tile per state and its
 * count — the tiles are the filter — and a search over the name in English or Arabic. A row opens
 * the campaign's workspace on its dashboard.
 *
 * No access probe yet (BackOffice 2759 seeds the author / approver roles): the leaf is visible to
 * every user and the door fails closed on the server; ticket 520 adds the probe.
 *
 * The tile and the search live in the URL (`?state=&q=`, replaced), so Back from a campaign lands
 * on the list as it was left.
 */
export default function CampaignListPage() {
  const { t } = useTranslation('campaign-list')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tile = tileFromParam(params.get('state'))
  const q = params.get('q') ?? ''

  const set = (change: { state?: StateTile; q?: string }) => {
    const next = { state: tile, q, ...change }
    const out = new URLSearchParams()
    if (next.state !== 'all') out.set('state', next.state)
    if (next.q) out.set('q', next.q)
    setParams(out, { replace: true })
  }

  const campaigns = useQuery(ruleCampaignsQuery())
  const rows = useMemo(() => campaigns.data ?? [], [campaigns.data])
  // Read once per render: the state of a campaign is its status read against the local now. The
  // grid's State column reads the SAME moment through the ref, so a badge and the tile it is
  // filtered under never disagree across a midnight.
  const now = new Date()
  const clock = useRef(now)
  clock.current = now
  const counts = stateCounts(rows, now)
  const shown = visibleRows(rows, tile, q, now)

  const columns = useMemo(() => campaignColumns(t, () => clock.current), [t])
  const gridContext = useMemo(() => ({ untitled: t('untitled') }), [t])

  const open = (e: RowClickedEvent<RuleCampaignListRow>) => {
    // The name is a link: a click on it has already navigated.
    if ((e.event?.target as Element | null)?.closest?.('a')) return
    if (e.data) navigate(campaignPath(e.data.id))
  }

  return (
    <section className="flex h-full w-full flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section aria-label={t('tiles.label')} data-tiles="">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
          <Tile tile="all" count={campaigns.data ? counts.all : undefined} on={tile === 'all'} onClick={() => set({ state: 'all' })} />
          {CAMPAIGN_STATES.map((s) => (
            <Tile key={s} tile={s} count={campaigns.data ? counts[s] : undefined} on={tile === s} onClick={() => set({ state: s })} />
          ))}
        </div>
      </section>

      <label className="flex max-w-xl flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('search.label')}
        <span className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={t('search.placeholder')}
            className="h-9 w-full rounded-md border border-border/60 bg-background ps-8 pe-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            data-campaign-search=""
          />
        </span>
      </label>

      {campaigns.isError && (
        <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(campaigns.error, t('results.failed'))} />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-24rem)] min-h-96" data-campaigns-grid="">
          <AgGridReact<RuleCampaignListRow>
            theme={omsGridTheme}
            rowData={campaigns.isError ? [] : shown}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.id}
            onRowClicked={open}
            context={gridContext}
            rowClass="cursor-pointer"
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            suppressColumnVirtualisation
            loading={campaigns.isPending}
            noRowsOverlayComponent={NoRows}
            suppressNoRowsOverlay={campaigns.isError}
          />
        </div>
        {!campaigns.isError && (
          <div
            className="flex h-7 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
            data-status-bar=""
          >
            {campaigns.isPending ? (
              <span>{t('results.loading')}</span>
            ) : (
              <span data-status-count="">
                <Trans
                  t={t}
                  i18nKey="results.count"
                  count={rows.length}
                  values={{ n: shown.length, total: rows.length }}
                  components={{ n: <Ltr />, total: <Ltr /> }}
                />
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

const DEFAULT_COL_DEF: ColDef<RuleCampaignListRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}

/** A tile's accent: its state's severity as a top border, from the app tokens (the fleet tiles' look). */
const TILE_ACCENT: Record<Severity, string> = {
  ok: 'border-t-success',
  go: 'border-t-primary',
  warn: 'border-t-attention',
  bad: 'border-t-danger',
  mute: 'border-t-border',
}

function Tile({ tile, count, on, onClick }: { tile: StateTile; count: number | undefined; on: boolean; onClick: () => void }) {
  const { t } = useTranslation('campaign-list')
  const accent = tile === 'all' ? TILE_ACCENT.mute : TILE_ACCENT[CAMPAIGN_STATE_SEV[tile]]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      data-tile={tile}
      className={
        'flex flex-col items-start gap-0.5 rounded-lg border border-t-4 border-border/60 px-3 py-2 text-start transition-colors hover:bg-accent ' +
        accent +
        (on ? ' bg-muted ring-2 ring-primary/60' : ' bg-card')
      }
    >
      <span className="font-mono text-xl font-medium tabular-nums" data-tile-count="">
        <Ltr>{count === undefined ? '' : count.toLocaleString('en-US')}</Ltr>
      </span>
      <span className="text-xs text-muted-foreground">{tile === 'all' ? t('tiles.all') : t(`states.${tile}`)}</span>
    </button>
  )
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('campaign-list')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
