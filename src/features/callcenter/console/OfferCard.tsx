/**
 * The pitch card (spec 995 A, ticket 996) — a near-miss in the *One step away* column, said the
 * way the caller hears it:
 *
 * - a headline from the definition (*Buy 3, get the 4th free*), the author's label under it;
 * - the badges (*Phone orders only*, the tier with ✓ or ✗, *Ends Thu 3 Dec · 6 days left*);
 * - the unit strip, one slot per unit of the completed offer: *in basket*, *add*, *FREE*;
 * - one primary action, *Add 3 more, 1 of them free*: ONE `addItem` of the missing quantity of
 *   the offer's material, with stock at the order's store beside it (`ResolvePrereq`'s top row,
 *   read when the card is open, as the qualifying list always was);
 * - a Say line, in the console's language and in Arabic.
 *
 * 🚩 No money on this card (D5). For a grouping there is no one item to add: the action opens
 * the offer (`onOpenOffer`, the sheet, 997) or, with no sheet, the card's own qualifying list.
 *
 * 997 (D1): the title and *Open* open the offer sheet (`OfferSheet`); the chevron beside them is
 * the card's own disclosure (its stock pill, its list, the BBY link), as the title was before.
 *
 * Degrading: with no definition the headline is the 161 discount phrase where the wire sent one,
 * else the description; with no `unitsHave` the strip is hidden and the old meter and *add N
 * more* show.
 */
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { callCenterApi, prereqKey } from './api'
import AvailabilityPill from './AvailabilityPill'
import type { GuidanceActions } from './GuidanceStrip'
import type { GuidanceCard, GuidancePhrase } from './guidance-view'
import { formatOfferDay, tierPhrase, type OfferBadge } from './offer-badges'
import type { OfferStrip } from './offer-strip'
import { prereqRows } from './prereq-view'
import type { OfferPitch } from './promotions-panel'
import SayLine from './SayLine'

export default function OfferCard({
  card,
  pitch,
  open,
  onToggle,
  transactionId,
  actions,
  fallbackSay,
  meter,
  children,
}: {
  card: GuidanceCard
  pitch: OfferPitch
  open: boolean
  onToggle: () => void
  transactionId: string
  actions: GuidanceActions
  /** 987's sentence, said where the pitch has no add to name. */
  fallbackSay: GuidancePhrase | null
  /** The old have/need meter, drawn where there is no unit strip. */
  meter: ReactNode
  /** What the strip still draws under the card: the qualifying list, the BBY link. */
  children: ReactNode
}) {
  const { t } = useTranslation('callcenter')
  const add = pitch.add
  const say = add || !fallbackSay ? pitch.say : [fallbackSay, ...pitch.say.slice(1)]
  const openSheet = actions.onOpenOffer ? () => actions.onOpenOffer?.(card) : null
  return (
    <div
      data-cc-card={card.offerId}
      data-cc-card-class={card.klass}
      data-cc-card-open={open ? 'open' : 'closed'}
      data-cc-offer-card
      className="rounded-md border border-primary-border bg-card p-2.5"
    >
      <div className="flex items-start gap-1">
        {/* 997: the title opens the offer sheet (D1); with no sheet it is the disclosure, as before. */}
        <button
          type="button"
          onClick={openSheet ?? onToggle}
          aria-expanded={openSheet ? undefined : open}
          aria-haspopup={openSheet ? 'dialog' : undefined}
          className="flex min-w-0 flex-1 items-start gap-2 text-start"
          data-cc-offer-title
        >
          <span className="min-w-0 flex-1">
            <Headline card={card} pitch={pitch} />
            {/* The author's own words, as data: the subtitle under a headline, the headline where none resolved. */}
            {headlineResolved(card, pitch) && (
              <span
                className={`block text-xs text-muted-foreground ${open ? '' : 'truncate'}`}
                data-cc-card-desc
                data-cc-server-text
              >
                <bdi>{card.description}</bdi>
              </span>
            )}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-primary-800" data-cc-card-mark>
            <span aria-hidden>○ </span>
            {t('guidance.withinReach')}
          </span>
        </button>
        {openSheet && (
          <>
            <Button variant="ghost" className="min-h-10 shrink-0" onClick={openSheet} aria-haspopup="dialog" data-cc-offer-open>
              {t('offer.action.open')}
            </Button>
            <IconButton
              label={t(open ? 'offer.action.collapse' : 'offer.action.expand')}
              onClick={onToggle}
              aria-expanded={open}
              className="mt-1.5"
              data-cc-offer-toggle
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
            </IconButton>
          </>
        )}
      </div>

      {pitch.badges.length > 0 && <Badges badges={pitch.badges} />}

      {pitch.strip ? (
        <Strip strip={pitch.strip} />
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">{meter}</div>
      )}

      {card.set && !add && (
        <p className="mt-1 text-[11px] text-muted-foreground" data-cc-set>
          {t(card.set.key, card.set.params)}
        </p>
      )}

      {add && actions.onAdd && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            className="min-h-10 tabular-nums"
            disabled={actions.pending !== null}
            onClick={() =>
              actions.onAdd?.({
                offerId: card.offerId,
                itemNumber: add.itemNumber,
                itemName: add.itemName ?? add.itemNumber,
                qty: add.qty,
                uom: add.uom,
              })
            }
            data-cc-offer-add={add.qty}
          >
            {actions.pending?.offerId === card.offerId && actions.pending.itemNumber === add.itemNumber
              ? t('search.adding')
              : add.free === add.qty
                ? t('offer.action.addFreeOnly', { count: add.qty })
                : add.free > 0
                  ? t('offer.action.addFree', { count: add.qty, free: add.free })
                  : t('offer.action.add', { count: add.qty })}
          </Button>
          {open && <TopRowStock offerId={card.offerId} transactionId={transactionId} />}
        </div>
      )}
      {pitch.choose && (
        <div className="mt-2">
          <Button
            variant="secondary"
            className="min-h-10"
            onClick={() => (actions.onOpenOffer ? actions.onOpenOffer(card) : !open && onToggle())}
            data-cc-offer-choose
          >
            {t('offer.action.choose')}
          </Button>
        </div>
      )}

      {/* 🚩 Under the qualifying list, not above it: the route to the rest of a set must stay
          inside the clamp without scrolling (138 finding 1), and the Arabic line is a second row. */}
      {children}
      <SayLine phrases={say} bilingual />
    </div>
  )
}

/** Whether the headline is something other than the description (so the description is its subtitle). */
const headlineResolved = (card: GuidanceCard, pitch: OfferPitch) =>
  pitch.headline.kind === 'phrase' || card.definition !== null

function Headline({ card, pitch }: { card: GuidanceCard; pitch: OfferPitch }) {
  const { t } = useTranslation('callcenter')
  const className = 'block text-lg font-semibold leading-tight text-primary-800'
  if (pitch.headline.kind === 'phrase') {
    const { key, params } = pitch.headline.phrase
    return (
      <span className={className} data-cc-offer-headline data-cc-gives={card.offerId}>
        {t(key, isolatedFigures(params))}
      </span>
    )
  }
  // No v1.14 definition: the 161 discount phrase where the wire sent one, else the description.
  if (card.definition)
    return (
      <span className={className} data-cc-offer-headline data-cc-gives={card.offerId}>
        <Ltr>{t(card.definition.key, card.definition.params)}</Ltr>
      </span>
    )
  return (
    <span className={className} data-cc-offer-headline data-cc-card-desc data-cc-server-text>
      <bdi>{card.description}</bdi>
    </span>
  )
}

/** Figures inside a headline sentence are isolated whole; `count` stays a number for the plural. */
function isolatedFigures(params: GuidancePhrase['params']): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, key === 'count' || typeof value === 'boolean' ? value : fsi(String(value))]),
  )
}

function Badges({ badges }: { badges: OfferBadge[] }) {
  const { t, i18n } = useTranslation('callcenter')
  const pill = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium'
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5" data-cc-offer-badges>
      {badges.map((badge) => {
        if (badge.kind === 'phoneOnly')
          return (
            <span key="phone" className={`${pill} border-primary-border bg-primary-050 text-primary-800`} data-cc-offer-badge="phoneOnly">
              {t('offer.badge.phoneOnly')}
            </span>
          )
        if (badge.kind === 'tier') {
          const phrase = tierPhrase(badge.codes, i18n.getFixedT(i18n.language), i18n.language)
          return (
            <span
              key="tier"
              className={`${pill} ${
                badge.qualifies
                  ? 'border-success-border bg-success-050 text-success-800'
                  : 'border-danger-border bg-danger-050 text-danger-800'
              }`}
              data-cc-offer-badge="tier"
              data-cc-offer-qualifies={badge.qualifies ? 'yes' : 'no'}
            >
              {t(phrase.key, phrase.params)}
              <span aria-hidden>{badge.qualifies ? '✓' : '✗'}</span>
              <span>{t(badge.qualifies ? 'offer.badge.qualifies' : 'offer.badge.notQualifies')}</span>
            </span>
          )
        }
        return (
          <span key="ends" className={`${pill} border-attention-border bg-attention-050 text-attention-800`} data-cc-offer-badge="ends">
            {badge.days === 0
              ? t('offer.badge.endsToday')
              : t('offer.badge.ends', { date: fsi(formatOfferDay(badge.date, i18n.language)), count: badge.days })}
          </span>
        )
      })}
    </div>
  )
}

function Strip({ strip }: { strip: OfferStrip }) {
  const { t } = useTranslation('callcenter')
  const tone = {
    in: 'border-primary bg-primary text-primary-foreground',
    add: 'border-dashed border-border-strong bg-card text-muted-foreground',
    free: 'border-success-border bg-success-050 text-success-800',
  } as const
  return (
    <div className="mt-2" data-cc-offer-strip>
      <div className="flex flex-wrap gap-1" role="list" aria-label={t('offer.strip.label', { have: strip.have, total: strip.total })}>
        {strip.slots.map((slot, index) => (
          <span
            key={index}
            role="listitem"
            className={`inline-flex h-7 min-w-14 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold ${tone[slot]}`}
            data-cc-offer-slot={slot}
          >
            {t(`offer.strip.slot.${slot}`)}
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground" data-cc-offer-progress>
        {t('offer.strip.label', { have: strip.have, total: strip.total })}
      </p>
    </div>
  )
}

/**
 * Stock at the order's store for the offer's item: `ResolvePrereq`'s top row, ranked and
 * ATP-filtered by the server, read on demand while the card is open (the same cache entry the
 * qualifying list reads). A blank `offerId` (859) cannot be resolved, so nothing is asked.
 */
export function TopRowStock({ offerId, transactionId }: { offerId: string; transactionId: string }) {
  const { t } = useTranslation('callcenter')
  const resolved = useQuery({
    queryKey: prereqKey(transactionId, offerId),
    queryFn: () => callCenterApi.resolvePrereq(transactionId, offerId),
    enabled: offerId !== '',
    staleTime: Infinity,
    retry: false,
  })
  const top = prereqRows(resolved.data)[0]
  if (!top) return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" data-cc-offer-stock={top.itemNumber}>
      <span>{t('offer.action.stock')}</span>
      <AvailabilityPill availability={top.availability} keyBase="search.atp" />
    </span>
  )
}
