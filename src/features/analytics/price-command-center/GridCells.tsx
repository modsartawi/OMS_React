import { useTranslation } from 'react-i18next'
import type { PriceGridCell, PriceGridCompetitor, PriceGridRow } from '@/core/models/price-watch'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { cellView, oursView } from './grid'

const NS = 'price-command-center'

/**
 * One competitor's cell in the product grid (oms 935): drawn from `cellView`, nothing decided here. Used as the AG Grid
 * cell renderer of every competitor column, so it isolates its own values (`Ltr` around each whole formatted figure).
 */
export function CompetitorCell({ cell, competitor, currency }: { cell: PriceGridCell; competitor: PriceGridCompetitor; currency: string }) {
  const { t } = useTranslation(NS)
  const view = cellView(cell, competitor, currency)
  if (view.kind === 'unknown')
    return (
      <div className="py-1 text-xs text-muted-foreground" data-grid-cell="unknown">
        {t('grid.state.unknown')}
      </div>
    )
  if (view.kind === 'absent')
    return (
      <div className="flex flex-col py-1 text-xs text-muted-foreground" data-grid-cell={view.state}>
        {t(`grid.state.${view.state}`)}
        {view.cheapest && <CheapestMark />}
      </div>
    )
  const oos = view.state === 'OOS'
  return (
    <div className={'flex flex-col py-1 leading-tight ' + (view.stale ? 'opacity-60' : '')} data-grid-cell={view.state}>
      {oos ? (
        <>
          <span className="text-xs font-medium text-muted-foreground">{t('grid.state.OOS')}</span>
          <span className="text-xs text-muted-foreground">{t('grid.lastPrice', { price: fsi(view.paid) })}</span>
        </>
      ) : (
        <span className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium tabular-nums">
            <Ltr>{view.paid}</Ltr>
          </span>
          {view.struck && (
            <span className="text-xs tabular-nums text-muted-foreground line-through">
              <Ltr>{view.struck}</Ltr>
            </span>
          )}
          {view.offerPercent && (
            <span className="text-xs tabular-nums" data-grid-offer="">
              <Ltr>{view.offerPercent}</Ltr>
            </span>
          )}
        </span>
      )}
      {view.seller && (
        <span className="truncate text-xs text-muted-foreground" data-grid-seller="">
          {t('grid.seller')} <bdi>{view.seller}</bdi>
        </span>
      )}
      {view.observed && (
        <span className="text-xs tabular-nums text-muted-foreground">
          <Ltr>{view.observed}</Ltr>
        </span>
      )}
      {view.stale && (
        <span title={t('grid.staleHint')} data-grid-stale="">
          <StatusBadge sev="warn">{t('grid.stale')}</StatusBadge>
        </span>
      )}
      {view.cheapest && <CheapestMark />}
    </div>
  )
}

/** The row's cheapest mark — drawn wherever the endpoint's `isCheapest` says, ours included; ties mark every tied cell. */
function CheapestMark() {
  const { t } = useTranslation(NS)
  return (
    <span title={t('grid.cheapestHint')} data-grid-cheapest="">
      <StatusBadge sev="ok">{t('grid.cheapest')}</StatusBadge>
    </span>
  )
}

/** Our column, first: the effective price, the basic price beneath it, and any deal text. */
export function OursCell({ row }: { row: PriceGridRow }) {
  const { t } = useTranslation(NS)
  const view = oursView(row)
  return (
    <div className="flex flex-col py-1 leading-tight" data-grid-ours="">
      {view.priced ? (
        <>
          <span className="text-sm font-medium tabular-nums">
            <Ltr>{view.effective}</Ltr>
          </span>
          <span className="flex items-baseline gap-1 text-xs text-muted-foreground">
            {t('grid.basic')}
            <span className="tabular-nums">
              <Ltr>{view.basic}</Ltr>
            </span>
          </span>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">{t('grid.notPriced')}</span>
      )}
      {view.deal && (
        <span className="truncate text-xs" data-grid-deal="">
          <bdi>{view.deal}</bdi>
        </span>
      )}
      {row.isOurCheapest && <CheapestMark />}
    </div>
  )
}
