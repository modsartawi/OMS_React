import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ChevronRight } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import type { MissedPrereq, MissedPromo } from './promo-view'
import { KIND_CHIP, MISS_GLYPH, PROMO_CARD_ROW } from './promo-kind'
import SimBbyDetailsButton from './SimBbyDetailsButton'

// The "Could have applied" section (ticket 048) — the near-misses beneath the fired
// promotion blocks (SimPromoBlocks, 047). Driven by `promoView(result).missed` (045),
// it surfaces the promotions that COULD apply but did not, so an absent offer is
// diagnosed here rather than two tabs away — this folds in the old Potential Bonus
// Buys tab. Each entry is collapsed by default; expanding reveals:
//   • the driving UNMET prerequisite as a found-vs-required meter (found qty/value vs
//     required qty / min value — the data `potentialBonusBuys[].prerequisites[].isMet`
//     already carries, projected onto `missed[].prereq`);
//   • a short plain-language REASON ("basket has 50.00 of the 100.00 minimum").
// When accumulation (not a prerequisite) blocked it, `prereq` is null and the server
// `skipReason` reads as the reason instead. Absent entirely when nothing was missed
// (the whole section returns null), so a fully-fired basket shows no "Could have applied".
//
// TICKET 117 — REINSTATED. This component was built, then commented out of the page,
// so "why didn't it fire?" had no answer on screen at all. It comes back into the SAME
// rail as the fires, and it loses its own frame: `SimPromotionsRail` is the frame, this
// is a sub-section inside it (an `h3`, not the fourth `h2` on a three-heading screen).
//
// Two changes came with the reinstatement.
//
// The card is MARKED as a near-miss: `○` takes the tile the fired card gives its kind
// glyph, so the two card shapes are told apart at a glance and can therefore share a
// column. The condition type the promotion WOULD have applied is not lost with the
// glyph — it is named in words beside the identity (`promo.kindTag.*`), which is what
// the ticket asks a card to print and reads better than a glyph anyway.
//
// And the found-vs-required meter's fill leaves `bg-attention` for a neutral ink. THIS
// is the hue correction: a near-miss is neutral, not a warning — the screen's budget is
// two hues, spent on a fired promotion and a `W` line, and a near-miss is neither.
// (The tile itself was already neutral: ticket 088 retired the per-kind colour map, so
// `KIND_CHIP` has spent no hue since.) Nothing here promises a fault; it reports an
// unmet prerequisite.
//
// TICKET 161 — THE CARD STOPS PROMISING A SAVING IT CANNOT KNOW. Where the header
// printed a would-save figure it now prints what the offer GIVES: the discount
// DEFINITION (`35% off`, `Both for 26.04`), resolved through the shared wording rule
// in `@/core/promotions`. The retired figure was `discount.value`, which is a
// PERCENTAGE for the `%` kind — and it went through `formatMoney` beside a currency
// word, so the capture's `70% 2nd PCS` promotion read `35.00 SAR`: a number the
// engine never computed and the customer would never see. A real savings total
// requires firing the promotion (spec 574 US26), so the honest card states the
// definition and no total at all. The card therefore takes no `currency` any more —
// the only money on it was the invented figure.

interface Props {
  missed: MissedPromo[]
  /** Open the bonus-buy detail modal for a promotion — `null` when the grant is not
   *  CONFIRMED (ticket 118). The near-miss is the STRONGER case for this control, not
   *  the weaker one: a missed promotion carries no prerequisite data on the wire (the
   *  captures sent `prerequisites: []` on all four), so the modal is the only route to
   *  a miss's rules. If the affordance is ever cut back, it is kept HERE. */
  onOpenBbyDetails: ((bbyNumber: string) => void) | null
}

export default function SimMissedPromotions({ missed, onOpenBbyDetails }: Props) {
  const { t } = useTranslation('simulation')

  // A fully-fired basket has no near-misses — the section is absent, not empty.
  if (missed.length === 0) return null

  return (
    <div data-promo-missed-section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* An `h3`, not the fourth `h2` on a three-heading screen — the near-misses are a
            sub-section of Promotions, not a frame of their own. And no CSS `uppercase`:
            a transform is a no-op on Arabic script, so uppercase on this screen is
            authored in the JSON value or not at all (spec 110's uppercase inventory). */}
        <h3 className="text-xs font-semibold tracking-tight text-muted-foreground">
          {t('missed.sectionTitle')}
        </h3>
        {/* `1 near-miss` — the sibling count badge to the rail's `1 fired`, and the same
            audit finding: a run opening with a digit reorders. Isolated whole (121). */}
        <span className="text-[11px] font-medium text-muted-foreground">
          <Ltr>{t('missed.count', { count: missed.length })}</Ltr>
        </span>
      </div>

      {/* The same card row as the fires (ticket 119), from the same source — a
          near-miss is a card-sized card at every width too. Its own grid ELEMENT rather
          than one shared with the fires, so a near-miss can never rise onto a row
          beside a fire: what happened reads before what did not, and that order is the
          section boundary. */}
      <div className={PROMO_CARD_ROW + ' gap-2'}>
        {missed.map((m) => (
          <MissedRow key={m.bbyNumber} missed={m} onOpenBbyDetails={onOpenBbyDetails} t={t} />
        ))}
      </div>
    </div>
  )
}

function MissedRow({
  missed,
  onOpenBbyDetails,
  t,
}: {
  missed: MissedPromo
  onOpenBbyDetails: ((bbyNumber: string) => void) | null
  t: TFunction
}) {
  const [expanded, setExpanded] = useState(false)
  const name = missed.description || t('missed.fallbackName')

  return (
    <div
      data-promo-card="missed"
      data-bby={missed.bbyNumber}
      className={'rounded-lg border bg-card transition-colors ' + (expanded ? 'border-border' : 'border-border/60')}
    >
      {/* Collapsed header — the disclosure trigger: `○` · name · would-save · chevron. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 rounded-lg p-2.5 text-start hover:bg-muted/40"
      >
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm font-bold ${KIND_CHIP}`}
          aria-hidden
        >
          {MISS_GLYPH}
        </span>
        <span className="min-w-0 flex-1">
          {/* THE offender the 106 audit found instead of the one it expected: the raw
              server promotion title (`2 PC for 29.95 SR`, `70% 2nd PCS`). It opens with a
              digit and reorders, and — unlike the English we compose — it **cannot be
              re-worded**, because it is server data passed through as data. Isolated. */}
          <span className="block truncate text-sm font-medium">
            <Ltr>{name}</Ltr>
          </span>
          <IdentitySubLine missed={missed} t={t} />
        </span>
        {/* WHAT THE OFFER GIVES — the discount definition, in the slot the invented
            would-save figure used to hold (see the header note). Absent when the
            wire's discount code did not classify: the server's own description, on
            the line beside it, is then the whole of what the card can honestly say.

            The label is authored uppercase in the JSON, not transformed in CSS: a
            `uppercase` transform is a no-op on Arabic script (spec 110's inventory).

            Isolated whole: the phrase OPENS with a digit (`35% off`) and reorders
            under RTL — the same audit finding as every other figure on this screen. */}
        {missed.definition ? (
          <span className="shrink-0 text-end">
            <span className="block text-[9px] font-bold tracking-wide text-muted-foreground">
              {t('missed.givesLabel')}
            </span>
            <span className="block text-sm font-semibold">
              <Ltr>{t(missed.definition.key, missed.definition.params)}</Ltr>
            </span>
          </span>
        ) : null}
        {/* One twisty idiom across the screen (ticket 121): the flip rides the CLOSED
            state, where the chevron points the way the text runs; open it points down,
            which is direction-neutral. Composing a rotate with a mirror is the
            double-mirror trap in its second form — two transforms on one property,
            resolved by stylesheet order rather than by intent. */}
        <ChevronRight
          data-card-twisty={expanded ? 'open' : 'closed'}
          className={
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform ' +
            (expanded ? 'rotate-90' : 'rtl:-scale-x-100')
          }
          aria-hidden
        />
      </button>

      {/* Expanded — the found-vs-required meter + a plain-language reason. */}
      {expanded ? (
        <div className="border-t border-border/60 p-2.5">
          {missed.prereq ? (
            <PrereqMeter prereq={missed.prereq} t={t} />
          ) : (
            <p className="text-xs text-muted-foreground">
              {missed.skipReason ? t('missed.skipReason', { reason: missed.skipReason }) : t('missed.noReason')}
            </p>
          )}
        </div>
      ) : null}

      {/* Last on the card, below the would-save amount (ticket 118) — and OUTSIDE the
          disclosure, so it does not have to be found before it can be used: on a
          near-miss the modal is the only place the promotion's rules exist at all. */}
      {onOpenBbyDetails && missed.bbyNumber ? (
        <SimBbyDetailsButton bbyNumber={missed.bbyNumber} onOpen={onOpenBbyDetails} />
      ) : null}
    </div>
  )
}

/** BBY key · promo no · CONDITION TYPE — the near-miss identity, as separated spans (not
 *  a concatenated `·`) so the middot never mis-orders between bidi runs under RTL. Empty
 *  parts drop.
 *
 *  The kind rides here in words (ticket 117) rather than as the glyph the tile used to
 *  carry, because the tile is now the `○` that says this promotion did not fire. It is
 *  the same `promo.kindTag.*` vocabulary a fired card's Get box spells, so one promotion
 *  reads the same whether it fired or nearly did. Absent when the wire's discount code
 *  did not classify — `promoView` keeps that honest rather than guessing. */
function IdentitySubLine({ missed, t }: { missed: MissedPromo; t: TFunction }) {
  const parts = [
    missed.bbyNumber || null,
    missed.promoNumber ? t('promo.promoNoLabel', { promo: missed.promoNumber }) : null,
    missed.kind ? t(`promo.kindTag.${missed.kind}`) : null,
  ].filter((p): p is string => Boolean(p))

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-x-1.5">
          {i > 0 ? (
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
          ) : null}
          {/* Each part is its own isolate — `000100000131`, `promo 0001000040`, the kind
              in words. The separated-spans spelling this function already used keeps the
              middots out of the runs; the isolate keeps each part's own digits in
              order (121). */}
          <Ltr>{p}</Ltr>
        </span>
      ))}
    </span>
  )
}

/** The driving unmet prerequisite as a found-vs-required meter: value-based when the
 *  prereq carries a minimum value, else quantity-based. The reason line reads the same
 *  numbers in plain language. */
function PrereqMeter({ prereq, t }: { prereq: MissedPrereq; t: TFunction }) {
  // Decide the value-vs-qty axis once, then read found / required / formatter / reason
  // off that single choice — rather than re-deciding `value ? … : …` at each use.
  const value = prereq.minValue > 0
  const found = value ? prereq.foundValue : prereq.foundQty
  const required = value ? prereq.minValue : prereq.requiredQty
  const fmt = value ? formatMoney : formatNumber
  const reasonKey = value ? 'missed.reasonValue' : 'missed.reasonQty'
  // Guard a zero/absent requirement (neither qty nor value drives it) so the bar and
  // reason never divide by zero — fall back to the prereq identity alone.
  const hasTarget = required > 0
  const pct = hasTarget ? Math.min(100, Math.max(0, (found / required) * 100)) : 0

  const subject = prereq.materialNumber
    ? t('missed.prereqMaterial', { material: prereq.materialNumber })
    : prereq.matGrouping
      ? t('missed.prereqGrouping', { grouping: prereq.matGrouping })
      : t('missed.prereqAny')

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-medium">{subject}</span>
        {hasTarget ? (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {t('missed.found', { found: fmt(found), required: fmt(required) })}
          </span>
        ) : null}
      </div>

      {hasTarget ? (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={found}
          aria-valuemin={0}
          aria-valuemax={required}
        >
          {/* Neutral ink, not `bg-attention` (ticket 117): the two-hue budget is spent
              on a fired promotion and a `W` line, and a near-miss is neither. */}
          <div data-prereq-meter className="h-full rounded-full bg-ink-3" style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {hasTarget ? t(reasonKey, { found: fmt(found), required: fmt(required) }) : t('missed.noReason')}
      </p>
    </div>
  )
}
