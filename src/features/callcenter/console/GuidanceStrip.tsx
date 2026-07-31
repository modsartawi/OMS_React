/**
 * The guidance strip (ticket 171) — the reason this screen exists.
 *
 * Every offer the basket **nearly** qualifies for, visible without opening
 * anything, under the basket, in a strip that **wraps**: cards grow into the
 * centre column's dead space and the region gets taller, never wider. A
 * horizontal scroll is the one gesture nobody performs mid-call.
 *
 * 138's ruling (variant 1) ships with three layout properties that are
 * **load-bearing, not polish** — the wrapping strip was the one shape the drive
 * measured over 135's density budget, and the ruling is only safe because these
 * were already in the prototype when it was measured:
 *
 *   1. an **open card spans both columns** (finding 3: a single open card in a
 *      2-up grid squeezes its rows beside ~500px of nothing);
 *   2. the **body is clamped (18rem)** and the head — heading, count, and the
 *      outcome banner 172 hangs here — is **pinned outside** it (finding 2);
 *   3. the default-open card is the **top-ranked actionable offer by
 *      construction** (finding 4), which is `guidanceView`'s `openByDefault` and
 *      never a hardcoded id.
 *
 * 🚩 A clamped region turns new content into scroll rather than height, so the
 * drive asserts what is **visible** and not how tall this is — 138's own finding,
 * the hard way.
 *
 * Every rule about what a card may SAY is `guidance-view.ts`'s: the three
 * classes, the order, the definition wording (161's, from `@/core/`), and the
 * skip-reason words. This file arranges them and owns no vocabulary of its own.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Loader2, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Ltr from '@/core/ui/Ltr'
import type { AddOutcome, GuidanceAdd } from './add-outcome'
import { callCenterApi, prereqKey } from './api'
import AvailabilityPill from './AvailabilityPill'
import { NOTE } from './console-notes'
import type { GuidanceCard, GuidanceView } from './guidance-view'
import type { SearchRowView } from './item-search'
import { prereqRows, restOfSet } from './prereq-view'

/**
 * The half of the guidance surface that DOES something (ticket 172) — the add,
 * what it is currently doing, what the engine did with it, and the hand-off to
 * the item search for a set too big to draw.
 *
 * The verb itself is the page's, like every other verb on this screen: `addItem`
 * returns the whole `SessionState` and the cache is the store of record.
 */
export interface GuidanceActions {
  /** 🚩 `null` while `capabilities.canAddItem` is false — a control the door
   *  would refuse is worse than no control (165's ruling, and the same rule the
   *  search row's *Add* follows). */
  onAdd: ((add: GuidanceAdd) => void) | null
  /** The row currently adding, as the offer AND the item: two cards can list the
   *  same item, and only the row that launched the add says *Adding…*. It is the
   *  same triple `onAdd` takes — one type rather than three loose strings, so a
   *  caller cannot swap two of them and still compile. */
  pending: GuidanceAdd | null
  /** What the engine actually did with the last add — already classified. */
  outcome: AddOutcome | null
  dismissOutcome: () => void
  /** The route to the rest of a set: narrow the console's OWN item search to
   *  this offer. Never a second list (138). */
  onSearchRest: (offerId: string, description: string) => void
}

export default function GuidanceStrip({
  view,
  transactionId,
  actions,
}: {
  view: GuidanceView
  /** Which order the qualifying items are resolved for — the set is ranked and
   *  ATP-filtered at THIS order's plant, server-side. */
  transactionId: string
  actions: GuidanceActions
}) {
  const { t } = useTranslation('callcenter')
  // Which card is open. `undefined` is *nobody has chosen* — the top-ranked
  // actionable offer opens by construction; `null` is *the agent closed it*; an
  // id that is no longer actionable (its offer fired, or the basket moved) falls
  // back to the construction rather than leaving the strip with nothing open.
  //
  // 🚩 It is the card's `cardId`, NOT its `offerId`: the v1.2 capture ships every
  // `offerId` blank (859), and keying on it made two distinct offers one card —
  // React de-duplicated them and opening one opened both.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined)
  const open =
    chosen !== undefined && (chosen === null || view.actionable.some((card) => card.cardId === chosen))
      ? chosen
      : view.openByDefault
  const [showUnavailable, setShowUnavailable] = useState(false)

  return (
    <section className="shrink-0 border-t border-border-strong bg-muted/30" data-cc-guidance>
      {/* PINNED, outside the clamp — the heading, the coverage note, and (172)
          the outcome banner. Content that scrolled away here would be the one
          thing an agent needs after an add. */}
      <div className="px-4 py-1.5" data-cc-guidance-head>
        <div className="flex items-baseline justify-between gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>{t('guidance.heading')}</span>
          {view.actionableCount > 0 && (
            <span data-cc-guidance-strip-count>{t('guidance.topCount', { count: view.actionableCount })}</span>
          )}
        </div>
        {/* 787-C has not landed: buy-one-get-one near-misses are ABSENT, not
            empty. Said once, quietly, as a property of the surface — and it
            disappears on its own the moment the server starts sending them. */}
        {!view.getSideCovered && (
          <p className="mt-0.5 text-[11px] text-muted-foreground" data-cc-guidance-getside>
            {t('guidance.getSideAbsent')}
          </p>
        )}
        {/* 🚩 What the engine DID, pinned outside the clamp — the one thing an
            agent needs after an add, and the one thing a scrolling body would
            take away from them. Its slot shipped with 171 because the layout
            property is load-bearing; this is its content. */}
        <Outcome outcome={actions.outcome} onDismiss={actions.dismissOutcome} />
      </div>

      {view.cards.length === 0 ? (
        <p className="px-4 pb-2 text-xs text-muted-foreground" data-cc-guidance-empty>
          {t('guidance.none')}
        </p>
      ) : (
        // The clamp. It is the scroller, so everything above stays put.
        <div className="max-h-[18rem] overflow-auto px-4 pb-2" data-cc-guidance-scroll>
          {view.actionable.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {view.actionable.map((card) => (
                <Card
                  key={card.cardId}
                  card={card}
                  open={open === card.cardId}
                  onToggle={() => setChosen(open === card.cardId ? null : card.cardId)}
                  transactionId={transactionId}
                  actions={actions}
                />
              ))}
            </div>
          )}

          {/* ALREADY COUNTED — fully qualified and out-ranked by a better offer.
              There is nothing to do, so it gets no card, no action, and none of
              the space a class with an action could use. */}
          {view.counted.length > 0 && (
            <div className="mt-2 border-t border-divider pt-2" data-cc-guidance-counted>
              <span className="text-[11px] text-muted-foreground">{t('guidance.alreadyCounted')}</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {view.counted.map((card) => (
                  <span
                    key={card.cardId}
                    data-cc-counted-item={card.offerId}
                    className="inline-flex max-w-full items-baseline gap-1.5 rounded-full border border-success-border bg-success-050 px-2 py-0.5 text-[11px] text-success-800"
                  >
                    <span aria-hidden>✓</span>
                    <Definition card={card} size="pill" />
                    <span className="truncate" data-cc-server-text>
                      <Ltr>{card.description}</Ltr>
                    </span>
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{t('guidance.countedMark')}</p>
            </div>
          )}

          {/* NOT AVAILABLE HERE — an origin or accumulation refusal no basket
              change can fix (128 makes this class permanent and common). One
              collapsed line, never a card: a card invites an action there is
              none of. Each row says WHY in the agent's words. */}
          {/* 🚩 159 — a coupon-gated offer, stated and never offered as an add.
              Its prerequisite is the campaign SKU, and `BonusBuySession.Prepare`
              filters only `!IsDeleted`, so a one-click add of that material
              would qualify the same bonus buy while burning nothing at the
              coupon service. Drawn flat, like the counted list: it is a fact
              about the basket, and the way to act on it is the coupon chip. */}
          {view.needsCoupon.length > 0 && (
            <div className="mt-2 border-t border-divider pt-2" data-cc-guidance-needs-coupon>
              <ul className="space-y-0.5">
                {view.needsCoupon.map((card) => (
                  <li
                    key={card.cardId}
                    data-cc-needs-coupon-item={card.offerId}
                    className="text-[11px] text-muted-foreground"
                  >
                    {card.description}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('guidance.needsCoupon', { count: view.needsCoupon.length })}
              </p>
            </div>
          )}

          {view.unavailable.length > 0 && (
            <div className="mt-2 border-t border-divider pt-2">
              <button
                type="button"
                onClick={() => setShowUnavailable(!showUnavailable)}
                aria-expanded={showUnavailable}
                data-cc-unavailable-toggle
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {t('guidance.unavailable', { count: view.unavailable.length })}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showUnavailable ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
              {showUnavailable && (
                <ul className="mt-1 space-y-0.5">
                  {view.unavailable.map((card) => (
                    <li
                      key={card.cardId}
                      data-cc-unavailable-item={card.offerId}
                      className="flex items-baseline gap-2 text-xs text-muted-foreground"
                    >
                      <span className="min-w-0 truncate" data-cc-server-text>
                        <Ltr>{card.description}</Ltr>
                      </span>
                      <span aria-hidden>—</span>
                      {/* 🚩 The agent's words, never the wire code — including
                          for a category this client has never seen. */}
                      <span className="shrink-0" data-cc-reason>
                        {card.reason ? t(card.reason.key, card.reason.params) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** The only class with an action, and the only one drawn as a card. */
function Card({
  card,
  open,
  onToggle,
  transactionId,
  actions,
}: {
  card: GuidanceCard
  open: boolean
  onToggle: () => void
  transactionId: string
  actions: GuidanceActions
}) {
  const { t } = useTranslation('callcenter')
  return (
    <div
      data-cc-card={card.offerId}
      data-cc-card-class={card.klass}
      data-cc-card-open={open ? 'open' : 'closed'}
      className={`rounded-md border border-primary-border bg-card p-2.5 ${open ? 'col-span-2' : ''}`}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-2 text-start">
        <span className="min-w-0 flex-1">
          <Definition card={card} size="headline" />
          {/* The server's own words. Demoted to the sub-line where a definition
              resolved, and the headline where none did — either way it is data,
              passed through and never re-worded. Isolated: a promotion title
              opens with a digit and reorders (`2 PC for 29.95 SR`).

              Truncated only while the card is closed: the open card has the
              strip's full width, and the offer the agent is about to read out is
              the one whose name they need whole. */}
          <span
            className={`block ${open ? '' : 'truncate'} ${card.definition ? 'text-xs text-muted-foreground' : ''}`}
            data-cc-card-desc
            data-cc-server-text
          >
            <Ltr>{card.description}</Ltr>
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-medium text-primary-800" data-cc-card-mark>
          <span aria-hidden>○ </span>
          {t('guidance.withinReach')}
        </span>
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {card.progress && <Meter have={card.progress.have} need={card.progress.need} />}
        {card.shortfall > 0 && (
          <span className="text-xs text-foreground" data-cc-delta>
            {t('guidance.add', { count: card.shortfall })}
          </span>
        )}
      </div>

      {/* The honest set statement — *any 1 from this selection · 42 qualify*.
          On EVERY card, open or closed: a grouping prerequisite is a set, and a
          card that stated a delta without its cardinality would imply the caller
          must buy one particular item (US42). The ranked handful of what
          qualifies, and the route to the rest, are 172's. */}
      {card.set && (
        <p className="mt-1 text-[11px] text-muted-foreground" data-cc-set>
          {t(card.set.key, card.set.params)}
        </p>
      )}

      {/* 🚩 The prerequisite RESOLVED — on demand, and only while the card is
          open. Resolving every near-miss inline would pay a grouping expansion
          plus a stock read per keystroke for cards the agent mostly never opens
          (§3.3), which is the whole reason this endpoint is a second call. */}
      {open && <Qualifying card={card} transactionId={transactionId} actions={actions} />}
    </div>
  )
}

/**
 * What would actually close the gap: a **ranked, availability-filtered handful**
 * and the route to the rest.
 *
 * 🚩 **The handful is the server's `topN`, never a client slice** — nothing here
 * calls `.slice()`, which is what keeps the three the drive counts the same three
 * the engine ranked (138 finding 1, and `prereq-view.ts`'s first ruling).
 */
function Qualifying({
  card,
  transactionId,
  actions,
}: {
  card: GuidanceCard
  transactionId: string
  actions: GuidanceActions
}) {
  const { t } = useTranslation('callcenter')
  // 🚩 An offer the wire named with a blank id CANNOT be resolved, and asking
  // anyway is worse than not asking: `buildQuery` drops `''`, so the parameter
  // never leaves the browser and the endpoint answers 500 on a required-query
  // failure rather than the envelope's own refusal
  // ([859](C:\Work\DMSCO\BackOffice\.issues\859-near-miss-offer-id-is-blank.md) —
  // every `BbyHeader.OfferId` in dev master data is blank). The card keeps its
  // meter and its set statement, which is everything the agent can say out loud
  // except the ranked handful; only the handful is missing, and it is missing
  // OUT LOUD. `cardId`'s positional fallback is not a substitute — a position is
  // not an offer identity and must never be sent (see `guidance-view.ts`).
  const addressable = card.offerId !== ''
  const resolved = useQuery({
    queryKey: prereqKey(transactionId, card.offerId),
    queryFn: () => callCenterApi.resolvePrereq(transactionId, card.offerId),
    enabled: addressable,
    // 🚩 The rows must NOT move while an add launched from one of them is
    // running. The answer is a ranked set at the order's plant, so a re-fetch on
    // every re-price would re-rank the list under the agent's cursor mid-click —
    // and the outcome banner, not a silently re-ordered list, is what tells them
    // what happened.
    staleTime: Infinity,
    retry: false,
  })
  const rows = prereqRows(resolved.data)
  const rest = restOfSet(resolved.data, card.eligible)

  // A disabled query sits at `isPending` forever, so the unaddressable case is
  // answered here rather than folded into the states below — it is not a load
  // that has not finished, and it must never read as one.
  if (!addressable)
    return (
      <div className="mt-2 border-t border-divider pt-1.5" data-cc-qualifying="">
        <p className="py-1 text-[11px] text-muted-foreground" data-cc-qualifying-unaddressable>
          {t('guidance.resolveUnaddressable')}
        </p>
      </div>
    )

  return (
    <div className="mt-2 border-t border-divider pt-1.5" data-cc-qualifying={card.offerId}>
      {resolved.isPending && (
        <p className="flex items-center gap-1.5 py-1 text-[11px] text-muted-foreground" data-cc-qualifying-loading>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t('guidance.resolving')}
        </p>
      )}
      {resolved.isError && (
        <p className={`py-1 ${NOTE.danger}`} data-cc-qualifying-error>
          {apiErrorMessage(resolved.error, t('guidance.resolveFailed'))}
        </p>
      )}
      {resolved.isSuccess && rows.length === 0 && (
        <p className="py-1 text-[11px] text-muted-foreground" data-cc-qualifying-empty>
          {t('guidance.resolveEmpty')}
        </p>
      )}
      {rows.length > 0 && (
        <>
          <p className="text-[11px] text-muted-foreground">{t('guidance.qualifying')}</p>
          <div className="divide-y divide-divider">
            {rows.map((row) => (
              <QualifyingRow key={row.itemNumber} offerId={card.offerId} row={row} actions={actions} />
            ))}
          </div>
        </>
      )}
      {rest && (
        // 🚩 A hand-off, not a second list: it narrows the console's OWN item
        // search to this offer. A modal here would be the second screen 138
        // ruled out, and at 997 the card cannot be the list.
        <button
          type="button"
          onClick={() => actions.onSearchRest(card.offerId, card.description)}
          data-cc-search-rest={card.offerId}
          className="mt-1.5 text-[11px] font-medium text-primary hover:underline"
        >
          {t(rest.key, rest.params)}
        </button>
      )}
    </div>
  )
}

/**
 * One qualifying item — **the search row's own shape**, so the estimate sits on
 * the meta line beside the item number and the Arabic name and never in a money
 * column (`item-search.ts`, 135 amendment 1).
 *
 * 🚩 **The add runs on the row that launched it, and the row does not move while
 * it runs**: the list is not re-fetched, and only this row's button changes.
 */
function QualifyingRow({
  offerId,
  row,
  actions,
}: {
  offerId: string
  row: SearchRowView
  actions: GuidanceActions
}) {
  const { t } = useTranslation('callcenter')
  const adding = actions.pending?.offerId === offerId && actions.pending.itemNumber === row.itemNumber
  return (
    <div className="flex items-center gap-2 py-1" data-cc-qualifying-row={row.itemNumber}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs" data-cc-server-text>
          <Ltr>{row.title}</Ltr>
        </div>
        {/* 🚩 The meta line: item number · Arabic name · estimate. All three are
            secondary and the isolate is `dir`-pinned (138 finding 1 of the
            Arabic ruling — a bare `<bdi>` implies `dir="auto"` and flips the
            block). Putting Arabic here is what made the ruling cost zero pixels
            rather than pushing the route to the rest below the fold. */}
        <div className="flex min-w-0 items-baseline gap-2 text-[11px] text-muted-foreground" data-cc-qualifying-meta>
          {row.meta.map((part) => (
            <span
              key={part.id}
              className={part.id === 'description2' ? 'min-w-0 truncate' : 'shrink-0'}
              data-cc-qualifying-part={part.id}
              {...(part.id === 'description2' ? {} : { 'data-numeric': '' })}
            >
              <Ltr>{part.text}</Ltr>
            </span>
          ))}
        </div>
      </div>
      {/* LIVE availability, like the search row's — the set is ATP-filtered at
          the order's plant, and `unknown` is still not a zero. */}
      <AvailabilityPill availability={row.availability} keyBase="search.atp" />
      {actions.onAdd && (
        <button
          type="button"
          onClick={() => actions.onAdd?.({ offerId, itemNumber: row.itemNumber, itemName: row.title })}
          // Held while any add is in flight, for the reason the search panel
          // holds its rows: the engine's claim is a mutual exclusion, so a
          // second add collides and is ridden out — and two rows saying
          // *Adding…* would be one press the agent never made.
          disabled={actions.pending !== null}
          // Server text inside a console sentence, deliberately: an `aria-label`
          // is not a figure on screen, and *Add* alone tells a screen-reader
          // user nothing about which of three rows they are on.
          aria-label={t('guidance.addItem', { item: row.title })}
          data-cc-qualifying-add={row.itemNumber}
          className="shrink-0 rounded-full border border-primary-border bg-primary-050 px-2.5 py-0.5 text-[11px] font-medium text-primary-800 hover:bg-accent disabled:opacity-50"
        >
          {adding ? t('search.adding') : t('search.add')}
        </button>
      )}
    </div>
  )
}

/**
 * 🚩 **Three outcomes, because the re-price is the engine's and not the card's**
 * (`add-outcome.ts`). Two of them are the ones a naive implementation gets
 * wrong: *a better offer fired instead*, and *nothing fired* — where the offer
 * stays and only its meter moves. Silence on that path reads as a broken button.
 *
 * The console's own sentence is a `t()` phrase whose only parameter is a COUNT;
 * the item's name and the offer's description are server text, drawn as data
 * beside it. Which is what lets the region keep its *no figure formatted as
 * money* guarantee over a banner that names an offer called `SAR 10 off…`.
 */
function Outcome({ outcome, onDismiss }: { outcome: AddOutcome | null; onDismiss: () => void }) {
  const { t } = useTranslation('callcenter')
  if (!outcome) return null
  const tone =
    outcome.kind === 'didNotFire'
      ? 'border-attention-border bg-attention-050 text-attention-800'
      : 'border-success-border bg-success-050 text-success-800'
  return (
    <div
      className={`mt-1 flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs ${tone}`}
      role="status"
      data-cc-outcome={outcome.kind}
    >
      <div className="min-w-0 flex-1">
        <span data-cc-outcome-said>{t(outcome.phrase.key, outcome.phrase.params)}</span>{' '}
        <span className="opacity-90" data-cc-server-text>
          <Ltr>{outcome.itemName}</Ltr>
          {outcome.offerDescription ? ' · ' : ''}
          <Ltr>{outcome.offerDescription}</Ltr>
        </span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        data-cc-outcome-dismiss
        aria-label={t('guidance.outcome.dismiss')}
        title={t('guidance.outcome.dismiss')}
        className="shrink-0 rounded-full p-0.5 hover:opacity-70"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </div>
  )
}

/** What the offer GIVES, at headline size. Drawn as a caption it disappears; at
 *  headline size it carries the card on its own (138 part 1). 🚩 Never a savings
 *  total — `wouldSave` does not exist and is not computable client-side. */
function Definition({ card, size }: { card: GuidanceCard; size: 'headline' | 'pill' }) {
  const { t } = useTranslation('callcenter')
  if (!card.definition) return null
  return (
    <span
      data-cc-gives={card.offerId}
      className={
        size === 'headline' ? 'block text-lg font-semibold leading-tight text-primary-800' : 'shrink-0 font-semibold'
      }
    >
      {/* The phrase opens with a digit (`20% off`) and reorders under RTL. */}
      <Ltr>{t(card.definition.key, card.definition.params)}</Ltr>
    </span>
  )
}

/** 117's ruling, carried forward: the hue correction is the METER, not the tile. */
function Meter({ have, need }: { have: number; need: number }) {
  const { t } = useTranslation('callcenter')
  return (
    <span className="inline-flex items-center gap-1" aria-label={t('guidance.meter', { have, need })} data-cc-meter>
      {Array.from({ length: need }).map((_, index) => (
        <span
          key={index}
          className={`inline-block size-2 rounded-full ${
            index < have ? 'bg-primary' : 'border border-border-strong bg-transparent'
          }`}
          aria-hidden
        />
      ))}
      <span data-numeric className="ms-1 text-[11px] text-muted-foreground" aria-hidden>
        {have}/{need}
      </span>
    </span>
  )
}
