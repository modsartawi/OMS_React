/**
 * The *about this item* panel (ticket 185) — a search row expanded, answering
 * *"how much is that?"* with engine truth.
 *
 * 🚩 **Two registers on one screen, and they never swap places.** The row's `≈`
 * estimate keeps its meta-line home beside the item number (168's spatial rule,
 * untouched here); the engine's price appears only inside this panel, in a money
 * column, **with `SAR`** — because it is a real pricing run at the order's own
 * plant, origin, customer and loyalty and equals the basket line the item would
 * become. Nothing about the row changes shape when the panel opens, which is what
 * lets an agent scan a list while one row is expanded.
 *
 * 🚩 **A pricing failure is a refusal, never the estimate.** Every rule about
 * which of the four states the panel is in — and the guarantee that three of them
 * have no field a price could go in — is `price-check-view.ts`'s. This file
 * arranges them and decides nothing.
 *
 * The offers half is the guidance strip's own projection, so the agent learns one
 * vocabulary and not two: the discount *definition*, `progress`, `isReady`, and
 * **no figure formatted as money at all**. It carries no add — an offer's
 * prerequisite is a fact about a BASKET, and this item is not in one.
 *
 * 186 hangs `stockElsewhere` under the same heading, as an independent read that
 * **fails separately**: the price is a lock-free engine run inside SIS.Api, the
 * stock is the only remote HTTP hop on the contract, and a stock outage must not
 * cost the agent the price.
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { SessionState } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { formatMoney } from '@/core/util/number-format'
import { callCenterApi, priceCheckKey } from './api'
import { NOTE } from './console-notes'
import type { GuidanceCard } from './guidance-view'
import type { SearchRowView } from './item-search'
import Money from './Money'
import { priceCheckPanel } from './price-check-view'

export default function ItemPanel({ state, row }: { state: SessionState; row: SearchRowView }) {
  const { t } = useTranslation('callcenter')
  const canPriceCheck = state.capabilities.canPriceCheck === true

  const price = useQuery({
    queryKey: priceCheckKey(state.transactionId, row.itemNumber),
    queryFn: () => callCenterApi.priceCheck(state.transactionId, row.itemNumber),
    // The gate is the server's and it is read here as well as at the control that
    // opens this panel: a capability that went false while the panel was open
    // must stop the ASK, not only hide the button that started it.
    enabled: canPriceCheck,
    // The basket moves under a long call and the price moves with it. The read is
    // pure and takes no claim (§3.4 rule 8), so re-asking costs the order nothing
    // — and a stale quote is the one number here that gets read out loud.
    staleTime: 0,
    // 🚩 Never retried. A refusal is the server's considered answer and the panel
    // says it; six of them would only delay the sentence the agent has to read.
    retry: false,
  })

  const panel = priceCheckPanel({
    canPriceCheck: state.capabilities.canPriceCheck,
    row,
    result: price.data,
    error: price.error,
    pending: price.isPending,
  })
  if (panel.kind === 'shut') return null

  return (
    <div
      className="border-b border-divider bg-card-2 px-3 py-2.5 last:border-0"
      data-cc-item-panel={row.itemNumber}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('panel.heading')}</div>

      {panel.kind === 'pending' && (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground" data-cc-panel-loading>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {t('panel.checking')}
        </p>
      )}

      {/* 🚩 The typed refusal, in the agent's words and with no figure anywhere
          near it. The one thing that must never happen here is the estimate
          appearing in the price's place — a number ~13% under what the caller
          pays, read out loud with nothing beside it to correct it. */}
      {panel.kind === 'refused' && (
        <p className={`mt-1 ${NOTE.danger}`} data-cc-panel-refusal>
          {t(panel.refusal.key, panel.refusal.params)}
        </p>
      )}

      {panel.kind === 'quoted' && (
        <>
          <div className="mt-1 flex items-baseline justify-between gap-3" data-cc-panel-price>
            {/* Engine money, in the money register, exactly like a basket line —
                because it IS that line's price, one unit of it. */}
            <Money value={panel.quote.gross} size="lg" />
            <span className="min-w-0 truncate text-[11px] text-muted-foreground" data-cc-panel-priced-at>
              {/* The store is server text, interpolated as data. A price with no
                  store beside it is the seeded-plant harm said out loud. */}
              {t('panel.priceAt', { uom: panel.quote.uom, plant: panel.quote.plantName })}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('panel.unitNote')}</p>

          {/* The conditions behind it — the store price and VAT as SEPARATE
              things, the same shape the basket line draws, because that
              separation is what explains the gap to the `≈` estimate one line
              above. No currency word: `SAR` belongs to the total, once. */}
          {panel.quote.conditions.length > 0 && (
            <div
              className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground"
              data-cc-panel-conditions
            >
              <span className="uppercase tracking-wide">{t('line.pricedBy')}</span>
              {panel.quote.conditions.map((condition, index) => (
                <span key={`${condition.type}-${index}`} data-cc-panel-condition={condition.type}>
                  {condition.description}
                  <span className="ms-1" data-numeric>
                    {formatMoney(condition.value)}
                  </span>
                  {condition.isStatistical && <span className="ms-1">{t('line.statistical')}</span>}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 border-t border-divider pt-2" data-cc-panel-offers>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t('panel.offersHeading')}
            </div>
            {panel.offers.length === 0 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground" data-cc-panel-offers-none>
                {t('panel.offersNone')}
              </p>
            )}
            <ul className="mt-0.5 space-y-0.5">
              {panel.offers.map((offer, index) => (
                <Offer key={offer.cardId || index} offer={offer} />
              ))}
            </ul>
            {/* 🚩 130's blindness, made visible: silence must never read as *no
                offer exists*. It disappears on its own the day 787-C lands —
                one server boolean, no client change. */}
            {!panel.offersComplete && (
              <p className="mt-1 text-[11px] text-muted-foreground" data-cc-panel-offers-incomplete>
                {t('panel.offersIncomplete')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * One offer, in the guidance strip's vocabulary and with none of its actions.
 *
 * 🚩 **No figure formatted as money.** The definition is 161's phrase, the meter
 * is two counts, and the only string here the console did not author is the
 * server's own `description` — which may legitimately carry a currency word
 * (`"2 PC for 29.95 SR"`) and is passed through unedited as data.
 */
function Offer({ offer }: { offer: GuidanceCard }) {
  const { t } = useTranslation('callcenter')
  const shortfall = offer.klass === 'unavailable' ? 0 : offer.shortfall
  return (
    <li
      className="flex min-w-0 items-baseline gap-2 text-[11px]"
      data-cc-panel-offer={offer.offerId}
      data-cc-panel-offer-class={offer.klass}
    >
      {offer.definition && (
        <span className="shrink-0 font-semibold text-primary-800" data-cc-panel-gives>
          {/* The phrase opens with a digit (`20% off`) and reorders under RTL. */}
          <Ltr>{t(offer.definition.key, offer.definition.params)}</Ltr>
        </span>
      )}
      <span className="min-w-0 truncate text-muted-foreground" data-cc-server-text>
        <Ltr>{offer.description}</Ltr>
      </span>
      <span className="shrink-0 text-muted-foreground" data-cc-panel-offer-state>
        {offer.klass === 'unavailable' && offer.reason
          ? // The agent's words, never the wire code — including for a category
            // this client has never seen.
            t(offer.reason.key, offer.reason.params)
          : shortfall > 0
            ? t('panel.offerNeeds', { count: shortfall })
            : t('panel.offerApplies')}
      </span>
    </li>
  )
}
