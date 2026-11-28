/**
 * The promotions panel (spec 983 D7, ticket 987) — under the basket, in the order column.
 *
 * Two columns side by side where the order column is wide enough, stacked where it is not:
 * - **Applied** — one card per fired promotion: the server's description and amount, the lines
 *   it landed on by D4's numbers, the lines a coupon skipped, and a sentence to say. Since 996
 *   it is card D (`AppliedOfferCard`): the one line, its quantity and its arithmetic.
 * - **One step away** — the guidance strip (171/172/412–415), moved here with its cards, its
 *   verbs and its order unchanged, each within-reach card carrying a sentence to recommend it.
 *   Since 996 an actionable card is the pitch card (`OfferCard`).
 * - **Could still use** is absent: nothing the console reads lists coupons the caller holds and
 *   has not applied (`promotions-panel.ts`).
 *
 * Every figure is the server's (`promotions-panel.ts`); this file arranges and words them.
 */
import { useTranslation } from 'react-i18next'
import AppliedOfferCard from './AppliedOfferCard'
import GuidanceStrip, { type GuidanceActions } from './GuidanceStrip'
import type { AppliedCard, PromotionsPanel as PanelView } from './promotions-panel'

export default function PromotionsPanel({
  view,
  transactionId,
  plant,
  actions,
}: {
  view: PanelView
  transactionId: string
  plant: string
  actions: GuidanceActions
}) {
  const { t } = useTranslation('callcenter')
  return (
    <section className="@container shrink-0 border-t border-border-strong bg-muted/30" data-cc-promotions>
      <h2 className="px-4 pt-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        {t('promotions.heading')}
      </h2>
      {/* 1007 (spec 1006 D2): a Wasfaty or Nphies order is priced without offers, so the panel says
          so once instead of listing near-misses the order cannot reach. */}
      {view.prescription ? (
        <p className="px-4 pt-0.5 pb-2 text-xs text-muted-foreground" data-cc-promotions-prescription>
          {t('promotions.prescription')}
        </p>
      ) : (
        <div className="grid gap-x-3 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <AppliedColumn cards={view.applied} />
          <GuidanceStrip
            view={view.guidance}
            say={view.say}
            pitch={view.pitch}
            transactionId={transactionId}
            plant={plant}
            actions={actions}
          />
        </div>
      )}
    </section>
  )
}

function AppliedColumn({ cards }: { cards: AppliedCard[] }) {
  const { t } = useTranslation('callcenter')
  return (
    <div className="min-w-0 px-4 py-1.5" data-cc-applied>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('promotions.applied.heading')}</div>
      {cards.length === 0 ? (
        <p className="mt-0.5 text-xs text-muted-foreground" data-cc-applied-none>
          {t('promotions.applied.none')}
        </p>
      ) : (
        <ul className="mt-1 max-h-[18rem] space-y-2 overflow-auto">
          {cards.map((card) => (
            <AppliedOfferCard key={card.cardId} card={card} />
          ))}
        </ul>
      )}
    </div>
  )
}
