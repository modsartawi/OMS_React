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
 * cost the agent the price. That independence is built rather than promised —
 * `StockBlock` is a **sibling** of the price's states with its own query, its own
 * cache key and its own model, so neither half is inside the other's branch and
 * neither can take the other down.
 *
 * 🚩 **The stock block is read-only, by ruling** (§3.5 rule 1). It draws no
 * control at all: a store change re-prices every line and refuses atomically, and
 * this list is ranked *from* the order's plant, so a one-click rebind would
 * invalidate the list it was clicked from. It names that path in a sentence
 * instead — which is the whole of what the panel is permitted to do about it.
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { SessionState } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { callCenterApi, priceCheckKey, stockElsewhereKey } from './api'
import Conditions from './Conditions'
import { NOTE } from './console-notes'
import type { GuidanceCard } from './guidance-view'
import type { SearchRowView } from './item-search'
import Money from './Money'
import { priceCheckPanel } from './price-check-view'
import { stockView, type StockRow } from './stock-view'

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
    // The same read as `enabled` above, off the same const — one strictness
    // rule, not two that could drift apart.
    canPriceCheck,
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
              {t('panel.priceAt', { uom: panel.quote.uom, store: panel.quote.plantName })}
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
              <Conditions conditions={panel.quote.conditions} />
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

      {/* 🚩 A SIBLING of every price state above, never a child of the quoted one.
          The two reads share this panel and the gate and nothing else — so a
          refused price still lists the stores that have it, and a stock outage
          still leaves the price the agent asked for on screen. */}
      <StockBlock state={state} row={row} canPriceCheck={canPriceCheck} />
    </div>
  )
}

/**
 * Who else has it (ticket 186, §3.5) — the panel's second half.
 *
 * Everything about which of the five states this is, and about the ordering, the
 * unranked marker and the null distances, is `stock-view.ts`'s. This component
 * arranges them and decides nothing.
 */
function StockBlock({
  state,
  row,
  canPriceCheck,
}: {
  state: SessionState
  row: SearchRowView
  canPriceCheck: boolean
}) {
  const { t } = useTranslation('callcenter')

  const stock = useQuery({
    queryKey: stockElsewhereKey(state.transactionId, row.itemNumber),
    queryFn: () => callCenterApi.stockElsewhere(state.transactionId, row.itemNumber),
    // The same gate the price half reads, off the same const — one panel, one
    // predicate (§3.5 rule 7), and the ranking needs a chosen plant to rank from.
    enabled: canPriceCheck,
    // Availability moves while the call is happening, and this number is read out
    // loud. Re-asking takes no claim and costs the order nothing.
    staleTime: 0,
    // 🚩 Never retried, for the price half's reason and one of its own: the
    // server already raced its own ~3 s timeout and answered `available: false`
    // rather than throwing, so a throw here is a considered refusal, not a blip.
    retry: false,
  })

  const panel = stockView({
    canPriceCheck,
    result: stock.data,
    error: stock.error,
    pending: stock.isPending,
  })
  if (panel.kind === 'shut') return null

  return (
    <div className="mt-2 border-t border-divider pt-2" data-cc-stock={row.itemNumber}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('panel.stock.heading')}</div>

      {panel.kind === 'pending' && (
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground" data-cc-stock-loading>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t('panel.stock.checking')}
        </p>
      )}

      {panel.kind === 'refused' && (
        <p className="mt-1 text-[11px] text-danger-800" data-cc-stock-refusal>
          {t(panel.refusal.key, panel.refusal.params)}
        </p>
      )}

      {/* 🚩 *We could not check* — and it is its own sentence in its own element,
          because the one thing this block must never do is let an unanswered hop
          be read down a phone as *nobody has it*. */}
      {panel.kind === 'unknown' && (
        <p className="mt-0.5 text-[11px] text-muted-foreground" data-cc-stock-unknown>
          {t('panel.stock.unknown')}
        </p>
      )}

      {panel.kind === 'none' && (
        <p className="mt-0.5 text-[11px] text-muted-foreground" data-cc-stock-none>
          {t('panel.stock.none')}
        </p>
      )}

      {panel.kind === 'listed' && (
        <>
          <p className="mt-0.5 text-[11px] text-muted-foreground" data-cc-stock-count>
            {panel.truncated
              ? t('panel.stock.truncated', { shown: panel.rows.length, total: panel.withStock })
              : t('panel.stock.shown', { count: panel.withStock })}
          </p>
          {/* 🚩 An unranked list that does not announce itself is read as
              nearest-first. This line is the announcement, and it is drawn from
              the model's own flag rather than from *are the distances blank*. */}
          {panel.unranked && (
            <p className="mt-0.5 text-[11px] text-attention-800" data-cc-stock-unranked>
              {t('panel.stock.unranked')}
            </p>
          )}
          <ul className="mt-1 space-y-0.5">
            {panel.rows.map((store) => (
              <StoreRow key={store.plant} store={store} />
            ))}
          </ul>
          {/* The store-change path, in words and not as a control (§3.5 rule 1). */}
          <p className="mt-1 text-[11px] text-muted-foreground" data-cc-stock-readonly>
            {t('panel.stock.readOnly')}
          </p>
        </>
      )}
    </div>
  )
}

/**
 * One store that has it.
 *
 * 🚩 **One availability number, and it is ATP** — the same definition as the
 * search row's. The till's grid shows on-hand in the next column; two availability
 * numbers read down a phone is how the larger one gets promised.
 *
 * 🚩 **A null distance draws blank and the row still appears.** The element stays
 * so the columns still line up, and nothing is written into it — least of all a
 * nought, which reads as *here*.
 */
function StoreRow({ store }: { store: StockRow }) {
  const { t } = useTranslation('callcenter')
  return (
    <li className="flex min-w-0 items-baseline gap-2 text-[11px]" data-cc-stock-row={store.plant}>
      <span className="shrink-0 font-semibold text-ink-1" data-numeric>
        {store.plant}
      </span>
      <span className="min-w-0 truncate text-muted-foreground" data-cc-server-text>
        <Ltr>{[store.city, store.areaName].filter(Boolean).join(' · ')}</Ltr>
      </span>
      <span className="ms-auto shrink-0 text-muted-foreground" data-numeric data-cc-stock-distance={store.plant}>
        {store.distanceKm === null ? '' : t('panel.stock.distance', { km: store.distanceKm.toFixed(1) })}
      </span>
      <span className="shrink-0 font-medium text-ink-1" data-numeric data-cc-stock-atp={store.plant}>
        {t('panel.stock.atp', { qty: store.atp })}
      </span>
    </li>
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
  return (
    <li
      className="flex min-w-0 items-baseline gap-2 text-[11px]"
      // 🚩 The card's OWN id, never its `offerId`: every `offerId` in the v1.2
      // capture is the empty string (859), so two distinct offers would share one
      // handle and neither could be addressed. `guidance-view` mints this for
      // exactly that case.
      data-cc-panel-offer={offer.cardId}
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
      {/* The meter's two counts, in the strip's own words — `progress` is part of
          138's promise language, and two counts are not a figure formatted as
          money. Dropped where the wire stated no requirement to draw. */}
      {offer.progress && (
        <span className="shrink-0 text-muted-foreground" data-numeric data-cc-panel-progress>
          {t('guidance.meter', { have: offer.progress.have, need: offer.progress.need })}
        </span>
      )}
      <span className="shrink-0 text-muted-foreground" data-cc-panel-offer-state>
        <OfferState offer={offer} />
      </span>
    </li>
  )
}

/**
 * What the offer's state IS, said in words.
 *
 * 🚩 Branched on the **class**, never on `shortfall === 0`. `guidance-view` sets
 * a shortfall of nought on every class that is not `actionable` AND on an
 * actionable offer whose `progress` the wire did not state — so a not-ready offer
 * with no meter would have been announced as already applying, which is the exact
 * inverse of the fact. Where there is nothing honest to say, this says nothing:
 * silence beats a wrong sentence, and the description above still names the offer.
 */
function OfferState({ offer }: { offer: GuidanceCard }) {
  const { t } = useTranslation('callcenter')
  // The agent's words, never the wire code — including for a category this
  // client has never seen.
  if (offer.klass === 'unavailable') return offer.reason ? <>{t(offer.reason.key, offer.reason.params)}</> : null
  // `counted` IS `isReady`: on a one-unit run that means the offer applies to
  // this item as it stands.
  if (offer.klass === 'counted') return <>{t('panel.offerApplies')}</>
  return offer.shortfall > 0 ? <>{t('panel.offerNeeds', { count: offer.shortfall })}</> : null
}
