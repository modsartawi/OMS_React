import type { ICellRendererParams } from 'ag-grid-community'
import { useTranslation } from 'react-i18next'
import type { SimulationResultItem } from '@/core/models/simulation'
import type { PromoLineRef } from './promo-view'
import { KIND_CLASS } from './promo-kind'

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
/** The promotion currently hot (hovered/focused anywhere in the surface) — drives the
 *  grid↔block cross-highlight (ticket 047). `conditionKey` narrows the highlight to one
 *  buy↔get application when the projection (044) supplies it; `null` (the degradation
 *  path, or a whole-block hover) lights every line of the `bby`. */
export interface PromoHot {
  bby: string
  conditionKey: string | null
}

export interface PromoCellContext {
  promoByItem: Map<number, PromoLineRef[]>
  /** The hot promotion, or absent/null before any hover. */
  hot?: PromoHot | null
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
