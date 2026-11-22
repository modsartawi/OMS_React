import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ChartFrame from '@/core/charts/ChartFrame'
import SeriesChart from '@/core/charts/SeriesChart'
import { seriesColour, seriesDash, seriesInkOpacity } from '@/core/charts/slots'
import { formatMoneyIn } from '@/core/money'
import type { BrokenMatchWire, PriceWatchComparison, PriceWatchCompetitorSide } from '@/core/models/price-watch'
import { usePermissions } from '@/core/permissions'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { SHEET_BODY } from '@/core/ui/sheet-table'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair, formatRate, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { canManagePriceWatch } from './access'
import { priceDrillDownApi } from './api'
import { comparisonGap, drillDownMaterial, drillDownSearch, historyChart, perUnitView, seriesLabelWith, stampOrNull, type HistorySeries } from './drilldown'

const NS = 'price-command-center'
/** Every PriceWatch read shares this prefix: a Break refreshes the comparison, the price alerts and the grid alike. */
const PRICE_WATCH_KEY = ['price-watch'] as const
const comparisonKey = (material: string) => [...PRICE_WATCH_KEY, 'drilldown', material] as const

/**
 * Break a product match, then read every PriceWatch answer again (the comparison loses the side, the pair's live price
 * alert resolves MATCH_BROKEN, the material goes back to matching). Refusals (PWT-00025/00026) propagate to the caller.
 */
export async function breakAndRefresh(client: QueryClient, matchId: string): Promise<BrokenMatchWire> {
  const broken = await priceDrillDownApi.breakMatch(matchId)
  await client.invalidateQueries({ queryKey: PRICE_WATCH_KEY })
  return broken
}

/**
 * The material drill-down (oms 936, BackOffice spec 4127 decision 8), a side sheet over the page while the URL names a
 * material (`?material=`, see `drillDownSearch`). Our price and every competitor's price history on one chart (each
 * source labelled, the authoritative one solid, the other faint), and the product matches with Break (Manage).
 * Mounted once by the page, so any tab (the alert row today, the product grid with 935) opens it by link.
 */
export default function MaterialDrillDown() {
  const { search } = useLocation()
  const material = drillDownMaterial(search)
  if (material === null) return null
  return <DrillDownSheet key={material} material={material} />
}

function DrillDownSheet({ material }: { material: string }) {
  const { t, i18n } = useTranslation(NS)
  const titleId = useId()
  const navigate = useNavigate()
  const { search } = useLocation()
  const client = useQueryClient()
  const canManage = canManagePriceWatch(usePermissions())
  const close = () => navigate({ search: drillDownSearch(search, null) }, { replace: true })

  const comparison = useQuery({ queryKey: comparisonKey(material), queryFn: () => priceDrillDownApi.comparison(material), retry: false })
  const brk = useMutation({
    mutationFn: (matchId: string) => breakAndRefresh(client, matchId),
    onSuccess: () => toast.success(t('drilldown.break.done')),
  })

  return (
    <SideSheet onClose={close} width="w-[64rem]" aria-labelledby={titleId} data-drilldown={material}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('drilldown.eyebrow')}
        title={t('drilldown.title', { material: fsi(material) })}
        closeLabel={t('drilldown.close')}
        onClose={close}
        closeData={{ 'data-drilldown-close': '' }}
      />
      <div className={SHEET_BODY}>
        {comparison.isError ? (
          <ErrorBanner className="p-3" title={t('drilldown.failed')} message={apiErrorMessage(comparison.error, t('drilldown.failedHint'))} />
        ) : comparison.isPending ? (
          <p className="text-sm text-muted-foreground">{t('drilldown.loading')}</p>
        ) : (
          <>
            <OurPrice comparison={comparison.data} />
            <HistoryPanel comparison={comparison.data} locale={i18n.language} busy={comparison.isFetching} />
            {brk.isError && (
              <ErrorBanner className="p-3" title={t('drilldown.break.failed')} message={apiErrorMessage(brk.error, t('drilldown.failedHint'))}>
                {apiErrorCode(brk.error) && (
                  <span className="font-mono text-xs" data-break-refusal={apiErrorCode(brk.error)}>
                    <Ltr>{apiErrorCode(brk.error)}</Ltr>
                  </span>
                )}
              </ErrorBanner>
            )}
            <MatchesTable
              comparison={comparison.data}
              canManage={canManage}
              breaking={brk.isPending ? (brk.variables ?? null) : null}
              onBreak={(matchId) => !brk.isPending && brk.mutate(matchId)}
            />
          </>
        )}
      </div>
    </SideSheet>
  )
}

/** Our price today at the reference store: basic and effective, or "not priced today". */
function OurPrice({ comparison: c }: { comparison: PriceWatchComparison }) {
  const { t } = useTranslation(NS)
  return (
    <section className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border border-border/60 bg-card/40 p-3 text-sm" data-drilldown-ours="">
      <h3 className="text-xs font-semibold text-muted-foreground">{t('drilldown.ours.heading')}</h3>
      {c.isPriced ? (
        <>
          <span>
            <span className="text-xs text-muted-foreground">{t('drilldown.ours.basic')} </span>
            <Ltr>{formatMoneyIn(c.basicPrice, c.currency)}</Ltr>
          </span>
          <span className="font-medium">
            <span className="text-xs font-normal text-muted-foreground">{t('drilldown.ours.effective')} </span>
            <Ltr>{formatMoneyIn(c.effectivePrice, c.currency)}</Ltr>
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">
          {t('drilldown.ours.unpriced')}
          {c.unpricedReason && (
            <>
              {' '}
              <bdi>{c.unpricedReason}</bdi>
            </>
          )}
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        {t('drilldown.ours.store')} <Ltr>{c.referenceStore}</Ltr>
      </span>
      {stampOrNull(c.pricedAt) && (
        <span className="text-xs text-muted-foreground">
          {t('drilldown.ours.pricedAt')} <Ltr>{formatDateTime(c.pricedAt)}</Ltr>
        </span>
      )}
    </section>
  )
}

/** The price history chart and its key; with nothing to draw it says so instead. */
function HistoryPanel({ comparison, locale, busy }: { comparison: PriceWatchComparison; locale: string; busy: boolean }) {
  const { t } = useTranslation(NS)
  const { series, rows } = historyChart(comparison, { locale, label: seriesLabelWith(t) })
  return (
    <section className="flex flex-col gap-2" data-drilldown-history={rows.length}>
      <h3 className="text-xs font-semibold text-muted-foreground">{t('drilldown.chart.heading')}</h3>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground" data-drilldown-history-empty="">
          {t('drilldown.chart.empty')}
        </p>
      ) : (
        <>
          <ChartFrame busy={busy} hasChart>
            <SeriesChart
              form="line"
              stacking="none"
              series={series}
              rows={rows}
              colourBy="single"
              unit="SAR"
              format="decimal"
              locale={locale}
              ariaLabel={t('drilldown.chart.aria')}
              height={280}
              legend="hidden"
            />
          </ChartFrame>
          <HistoryKey series={series} />
        </>
      )}
    </section>
  )
}

/**
 * The product matches, one row per unbroken match: the competitor, the listing, exact or comparable and how it was made,
 * who and when, the latest competitor price with its source, the gap (in words: which side is cheaper), the per-unit
 * prices of a comparable match, and Break — with the Manage grant only, and only once the side carries its match id.
 */
export function MatchesTable({
  comparison: c,
  canManage,
  breaking,
  onBreak,
}: {
  comparison: PriceWatchComparison
  canManage: boolean
  /** The match whose Break is being sent, if any. */
  breaking: string | null
  onBreak: (matchId: string) => void
}) {
  const { t } = useTranslation(NS)
  const [confirming, setConfirming] = useState<string | null>(null)
  const th = 'px-2 py-1.5 text-start text-xs font-medium text-muted-foreground'
  if (c.competitors.length === 0)
    return (
      <p className="rounded-lg border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground" data-drilldown-matches-empty="">
        {t('drilldown.matches.empty')}
      </p>
    )
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground">{t('drilldown.matches.heading')}</h3>
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-sm" data-drilldown-matches="">
          <thead className="bg-muted/40">
            <tr>
              <th className={th}>{t('drilldown.matches.columns.competitor')}</th>
              <th className={th}>{t('drilldown.matches.columns.kind')}</th>
              <th className={th}>{t('drilldown.matches.columns.latest')}</th>
              <th className={th}>{t('drilldown.matches.columns.gap')}</th>
              <th className={th}>{t('drilldown.matches.columns.perUnit')}</th>
              {canManage && <th className={th}>{t('drilldown.matches.columns.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {c.competitors.map((side) => (
              <MatchRow
                key={side.matchId ?? `${side.competitorCode}|${side.listingUrl}`}
                side={side}
                currency={c.currency}
                canManage={canManage}
                busy={!!side.matchId && breaking === side.matchId}
                confirming={!!side.matchId && confirming === side.matchId}
                onAsk={() => setConfirming(side.matchId ?? null)}
                onCancel={() => setConfirming(null)}
                onBreak={() => {
                  if (!side.matchId) return
                  setConfirming(null)
                  onBreak(side.matchId)
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MatchRow({
  side,
  currency,
  canManage,
  busy,
  confirming,
  onAsk,
  onCancel,
  onBreak,
}: {
  side: PriceWatchCompetitorSide
  currency: string
  canManage: boolean
  busy: boolean
  confirming: boolean
  onAsk: () => void
  onCancel: () => void
  onBreak: () => void
}) {
  const { t } = useTranslation(NS)
  const td = 'px-2 py-2 align-top'
  const money = (v: number | null) => formatMoneyIn(v, currency)
  const gap = comparisonGap(side.gapPercent)
  const unit = perUnitView(side)
  const matchedAt = stampOrNull(side.matchedAt)
  const source = side.source || undefined
  return (
    <tr className="border-t border-border/60" data-match-row={side.competitorCode} data-match-id={side.matchId ?? ''}>
      <td className={td}>
        <div className="font-medium">
          <Ltr>{formatPair(side.competitorCode, side.competitorName)}</Ltr>
        </div>
        {side.listingUrl ? (
          <a href={side.listingUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-2 hover:underline" data-match-listing="">
            <bdi>{side.listingTitle || side.listingUrl}</bdi>
          </a>
        ) : (
          <bdi className="text-xs text-muted-foreground">{side.listingTitle}</bdi>
        )}
      </td>
      <td className={td}>
        <StatusBadge sev={side.matchKind === 'Exact' ? 'ok' : 'go'}>{t(`drilldown.kind.${side.matchKind}`)}</StatusBadge>
        <div className="text-xs text-muted-foreground">{t(`drilldown.madeBy.${side.madeBy}`)}</div>
        <div className="text-xs text-muted-foreground" data-match-who={side.matchedByUser ?? ''}>
          {side.matchedByUser || matchedAt ? (
            <>
              {side.matchedByUser && <bdi>{side.matchedByUser}</bdi>} {matchedAt && <Ltr>{formatDateTime(matchedAt)}</Ltr>}
            </>
          ) : (
            t('drilldown.matches.matchedUnknown')
          )}
        </div>
      </td>
      <td className={td}>
        {side.hasPrice ? (
          <>
            <div className={'text-xs tabular-nums ' + (side.offerPrice !== null ? 'line-through text-muted-foreground' : '')}>
              <Ltr>{money(side.regularPrice)}</Ltr>
            </div>
            {side.offerPrice !== null && (
              <div className="font-medium tabular-nums">
                <Ltr>{money(side.offerPrice)}</Ltr>
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground">{t('drilldown.state.noPrice')}</div>
        )}
        {side.sellerName && (
          <div className="text-xs text-muted-foreground">
            <bdi>{side.sellerName}</bdi>
          </div>
        )}
        {source && (
          <div className="text-xs text-muted-foreground" data-match-source={source}>
            {t('drilldown.currentSource')}: {t(`drilldown.source.${source}`)}
          </div>
        )}
        {stampOrNull(side.observedAt) && (
          <div className="text-xs text-muted-foreground">
            <Ltr>{formatDateTime(side.observedAt)}</Ltr>
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {side.isGone && <StatusBadge sev="bad">{t('drilldown.state.gone')}</StatusBadge>}
          {side.isStale && <StatusBadge sev="warn">{t('drilldown.state.stale')}</StatusBadge>}
          {!side.inStock && <StatusBadge sev="mute">{t('drilldown.state.outOfStock')}</StatusBadge>}
        </div>
      </td>
      <td className={td} data-match-gap={gap.kind}>
        {gap.kind === 'competitorCheaper' || gap.kind === 'weCheaper' ? (
          <span className={gap.kind === 'competitorCheaper' ? 'font-medium' : ''}>{t(`drilldown.gap.${gap.kind}`, { gap: fsi(gap.percent) })}</span>
        ) : (
          <span className="text-muted-foreground">{t(`drilldown.gap.${gap.kind}`)}</span>
        )}
      </td>
      <td className={td}>
        {unit && (
          <div className="flex flex-col text-xs" data-match-per-unit={unit.basis}>
            <span>
              <span className="text-muted-foreground">{t('drilldown.matches.ours')} </span>
              <Ltr>{formatRate(unit.ours, '', t(`drilldown.basis.${unit.basis}`))}</Ltr>
            </span>
            <span className={unit.cheaper === 'competitor' ? 'font-medium' : ''}>
              <span className="text-muted-foreground">{t('drilldown.matches.theirs')} </span>
              <Ltr>{formatRate(unit.theirs, '', t(`drilldown.basis.${unit.basis}`))}</Ltr>
            </span>
          </div>
        )}
      </td>
      {canManage && (
        <td className={td}>
          {!side.matchId ? (
            <Button variant="danger-outlined" aria-disabled title={t('drilldown.break.noMatchId')} data-match-break="">
              {t('drilldown.break.action')}
            </Button>
          ) : confirming ? (
            <div className="flex max-w-56 flex-col gap-1.5" data-match-break-confirm={side.matchId}>
              <span className="text-xs">{t('drilldown.break.confirm')}</span>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="danger" onClick={onBreak} data-match-break-yes={side.matchId}>
                  {t('drilldown.break.yes')}
                </Button>
                <Button variant="text" onClick={onCancel}>
                  {t('drilldown.break.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger-outlined" disabled={busy} onClick={onAsk} data-match-break={side.matchId}>
              {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {t('drilldown.break.action')}
            </Button>
          )}
        </td>
      )}
    </tr>
  )
}

/**
 * The chart's key, in HTML (the chart's own legend is hidden): each series' swatch in its own ink — solid, dashed or
 * faint — and its label naming the owner, the price and its source. The labels are free text (a competitor name), `<bdi>`.
 */
export function HistoryKey({ series }: { series: readonly HistorySeries[] }) {
  const { t } = useTranslation(NS)
  return (
    <ul aria-label={t('drilldown.chart.key')} className="flex flex-wrap gap-x-4 gap-y-1 text-xs" data-history-key="">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5" data-series-key={s.key} data-series-faint={String(s.faint)} data-series-source={s.source}>
          <svg width="18" height="6" aria-hidden className="shrink-0">
            <line x1="0" y1="3" x2="18" y2="3" stroke={seriesColour(s)} strokeWidth="2" strokeDasharray={seriesDash(s)} strokeOpacity={seriesInkOpacity(null, s)} />
          </svg>
          <bdi className={s.faint ? 'text-muted-foreground' : ''}>{s.label}</bdi>
        </li>
      ))}
    </ul>
  )
}
