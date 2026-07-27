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
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import type { GuidanceCard, GuidanceView } from './guidance-view'

export default function GuidanceStrip({ view }: { view: GuidanceView }) {
  const { t } = useTranslation('callcenter')
  // Which card is open. `undefined` is *nobody has chosen* — the top-ranked
  // actionable offer opens by construction; `null` is *the agent closed it*; an
  // id that is no longer actionable (its offer fired, or the basket moved) falls
  // back to the construction rather than leaving the strip with nothing open.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined)
  const open =
    chosen !== undefined && (chosen === null || view.actionable.some((card) => card.offerId === chosen))
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
                  key={card.offerId}
                  card={card}
                  open={open === card.offerId}
                  onToggle={() => setChosen(open === card.offerId ? null : card.offerId)}
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
                    key={card.offerId}
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
                      key={card.offerId}
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
function Card({ card, open, onToggle }: { card: GuidanceCard; open: boolean; onToggle: () => void }) {
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
