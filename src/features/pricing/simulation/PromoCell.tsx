import type { ICellRendererParams } from 'ag-grid-community'
import { useTranslation } from 'react-i18next'
import type { SimulationResultItem } from '@/core/models/simulation'
import type { PromoKind, PromoLineRef } from './promo-view'

// Results-grid cell renderer for the Promotion column (ticket 046): the promotion(s)
// touching a line, read at a glance without selecting it. Each ref shows a colour-coded
// KIND chip (Free goods / % off / Amount off / Set price — the sketch palette: free =
// good/green, percent = accent, fixed = warn/amber, setprice = info/blue) plus a ROLE
// tag (buy / get / buy+get). A line no promotion touched renders a plain em-dash, so
// promoted and un-promoted lines read distinct. On the degradation path (no applied-BBY
// projection yet, ticket 044) the role is null and only the kind chip shows.
//
// The per-line promo refs come from `promoView(result).lines` (ticket 045), passed into
// the grid via `context` — the row data stays the raw SimulationResultItem.
export interface PromoCellContext {
  promoByItem: Map<number, PromoLineRef[]>
}

/** kind → chip classes. Neutral bucket for an unclassifiable kind (kept honest). */
const KIND_CLASS: Record<PromoKind, string> = {
  free: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  percent: 'bg-primary/15 text-primary',
  fixed: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  setprice: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
}

export default function PromoCell(params: ICellRendererParams<SimulationResultItem>) {
  const { t } = useTranslation('simulation')
  const ctx = params.context as PromoCellContext | undefined
  const itemNumber = params.data?.itemNumber
  const promos = (itemNumber != null && ctx?.promoByItem.get(itemNumber)) || []

  if (promos.length === 0) {
    return (
      <span className="text-muted-foreground" aria-label={t('results.promoNone.label')}>
        {t('results.promoNone.mark')}
      </span>
    )
  }

  return (
    <span className="flex h-full flex-wrap items-center gap-1 py-1">
      {promos.map((p, i) => (
        <PromoTag key={`${p.bbyNumber}-${p.conditionKey ?? i}`} promo={p} t={t} />
      ))}
    </span>
  )
}

function PromoTag({ promo, t }: { promo: PromoLineRef; t: ReturnType<typeof useTranslation>[0] }) {
  const kindClass = promo.kind ? KIND_CLASS[promo.kind] : 'bg-muted text-muted-foreground'
  const kindLabel = t(`results.promoKind.${promo.kind ?? 'unknown'}`)
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${kindClass}`}>
        {kindLabel}
      </span>
      {promo.role ? (
        <span className="inline-flex items-center rounded border border-border px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t(`results.promoRole.${promo.role}`)}
        </span>
      ) : null}
    </span>
  )
}
