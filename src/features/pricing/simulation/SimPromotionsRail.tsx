import { useTranslation } from 'react-i18next'
import type { PromoView } from './promo-view'
import SimPromoBlocks from './SimPromoBlocks'
import SimMissedPromotions from './SimMissedPromotions'

/**
 * The promotions rail (ticket 117, spec 110) — the screen's third and last frame,
 * sitting BESIDE the results at 66/34 rather than below them.
 *
 * The first read after a run is *"did the promotion fire?"* — the ×1 → ×2 loop **is**
 * a promo experiment — yet that answer used to sit in a right-hand column below the
 * fold while net total took a `3xl` figure top-right. The rail brings it to eye level.
 *
 * **Fires and near-misses share one column.** They were two frames (047's blocks and
 * 048's "Could have applied"), and the near-miss half was commented out of the page
 * entirely, so "why didn't it fire?" had no answer on screen at all. Both are now
 * sub-sections of this one frame: a fired card carries its kind glyph, a near-miss
 * card a neutral `○`. A near-miss is **neutral, not a warning** — the hue budget is
 * two, spent on a fired promotion and a `W` line.
 *
 * **The rail is its own frame so the results never shift** when it grows or shrinks,
 * and it renders straight off the promo view — it never waits on the bonus-buy details
 * probe ([118](.issues/118-sim-bby-details-affordance.md) adds that control).
 *
 * ## The three things it can say
 *
 * | state | when | why not the others |
 * |---|---|---|
 * | `not-measured` | the RUN had promotions switched off | an empty rail would read as "nothing fired" when the truth is "nothing was measured" — the capture-driven ruling behind chipping the promotion flag in **both** states up in the strip |
 * | `empty` | promotions were on and nothing fired or nearly fired | a real, measured answer: this basket earns nothing |
 * | `cards` | anything fired or nearly fired | |
 *
 * `promotionApplicable` is read off the **request that produced the on-screen result**,
 * never off the checkbox as it currently stands — the checkbox may already describe the
 * next run (which is what the status slot's stale mark is for).
 */
interface Props {
  view: PromoView
  currency: string
  /** Whether the RUN on screen asked for promotions — `request.header.isPromotionApplicable`. */
  promotionApplicable: boolean
  /** The promotion hot anywhere in the surface, so a card can light its lines and
   *  vice-versa. A `bbyNumber`, not the results table's `PromoHot`: a CARD spans a whole
   *  bonus buy — potentially several applications — so it can neither raise nor read a
   *  `conditionKey`, and taking the wider type would mean accepting a field this
   *  component has no way to honour. */
  hotBby: string | null
  onHotChange: (bby: string | null) => void
}

export default function SimPromotionsRail({
  view,
  currency,
  promotionApplicable,
  hotBby,
  onHotChange,
}: Props) {
  const { t } = useTranslation('simulation')

  const fired = view.blocks.length
  const state = !promotionApplicable
    ? 'not-measured'
    : fired === 0 && view.missed.length === 0
      ? 'empty'
      : 'cards'

  return (
    // The card lists inside (`PROMO_CARD_ROW`) query the WORK AREA by name, not this
    // frame — the row is the stacked arrangement, so it reads the same 900 px
    // breakpoint that stacks it. So the rail declares no container of its own.
    <div
      data-promotions-rail={state}
      className="flex min-w-0 flex-col rounded-lg border border-border/60 bg-card p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{t('promo.paneTitle')}</h2>
        {/* The fired count is a fact about a run that measured — it has no meaning on a
            promo-off run, and printing `0 fired` there is the confusion the state exists
            to prevent. */}
        {state === 'cards' && fired > 0 ? (
          <span className="text-xs font-medium text-primary">{t('promo.firedCount', { count: fired })}</span>
        ) : null}
      </div>

      {state === 'not-measured' ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">{t('promo.notMeasured')}</p>
      ) : state === 'empty' ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">{t('promo.empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* A card lights on bby alone, which is exactly the set of lines it PRINTS —
              so the tint and the printed list can never disagree. */}
          <SimPromoBlocks
            blocks={view.blocks}
            currency={currency}
            hotBby={hotBby}
            onHotChange={onHotChange}
          />
          {/* Near-misses last, under the fires: what DID happen reads before what did
              not. Absent entirely when nothing was missed. */}
          <SimMissedPromotions missed={view.missed} currency={currency} />
        </div>
      )}
    </div>
  )
}
