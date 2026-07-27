/**
 * What the engine actually did with an add launched from a guidance card
 * (ticket 172) — three outcomes, decided by comparing the state before the add
 * with the state after it.
 *
 * 🚩 **The re-price is the engine's and not the card's**, which is the whole
 * reason this module exists. A card that assumed *add the missing item ⇒ this
 * offer fires* would be right most of the time and would lie the rest of it: the
 * prerequisite may have been one of several, and a better offer may have taken
 * the item instead. Two of the three outcomes are the ones a naive
 * implementation gets wrong:
 *
 * 1. **fired** — the offer moved to the fired list.
 * 2. **firedOther** — something else fired instead, and the agent has to be told
 *    which, because the caller is about to hear a different figure.
 * 3. **didNotFire** — nothing fired. The offer **stays**, only its meter moves
 *    (`1/2 → 2/3`). Silence here reads as a broken button, and removing the card
 *    reads as a bug.
 *
 * 🚩 **Nothing here is money and nothing here is a phrase.** Like
 * `guidance-view.ts`, what comes out is a key plus its params — and the params
 * are counts, never text: the item's name and the offer's description are
 * SERVER text, carried as their own fields so the render tier can draw them as
 * data (`data-cc-server-text`) rather than interpolate them into a sentence the
 * console authored. Real descriptions carry currency words (`SAR 10 off when you
 * buy 3` is in the contract's own fixture), and a region that guarantees *no
 * figure formatted as money* cannot make that guarantee about a sentence it
 * has glued server text into.
 */
import type { SessionState } from '@/core/models/callcenter'
import type { GuidancePhrase } from './guidance-view'

/** The three things the engine can have done. */
export type AddOutcomeKind = 'fired' | 'firedOther' | 'didNotFire'

/** One add, as the card launched it. `itemName` is display only — the wire
 *  carries an item number and a quantity, and never a price (law 1). */
export interface GuidanceAdd {
  offerId: string
  itemNumber: string
  itemName: string
}

export interface AddOutcome {
  kind: AddOutcomeKind
  /** The offer the agent was working on — the card the add was launched from. */
  offerId: string
  itemNumber: string
  /** Server text: what was added. Drawn as data, never interpolated. */
  itemName: string
  /**
   * Server text: the offer the banner is ABOUT — the card's own on `fired` and
   * `didNotFire`, and the one that fired instead on `firedOther`. Empty where
   * the projection carried no description; the sentence still stands without it.
   */
  offerDescription: string
  /** The meter, before → after. `didNotFire`'s whole content, and `null` where
   *  the projection stated no requirement a meter could draw. */
  progress: { from: { have: number; need: number }; to: { have: number; need: number } } | null
  /** How many the offer still needs after the add. `0` where it fired, or where
   *  the projection did not say. */
  stillNeeds: number
  /** The console's own sentence — key plus a COUNT. Never server text. */
  phrase: GuidancePhrase
}

/**
 * Compare the two states and say what happened.
 *
 * 🚩 *Fired* means **newly** fired. An offer already in `firedPromotions` before
 * the add was not fired by it, and reporting it as this add's doing would credit
 * the agent's click with something that had already happened.
 */
export function classifyAdd(
  before: SessionState,
  after: SessionState,
  add: GuidanceAdd,
): AddOutcome {
  const already = new Set((before.firedPromotions ?? []).map((promo) => promo.offerId))
  const newlyFired = (after.firedPromotions ?? []).filter((promo) => !already.has(promo.offerId))
  const mine = newlyFired.find((promo) => promo.offerId === add.offerId)

  if (mine)
    return outcome(add, 'fired', mine.description ?? '', null, 0, {
      key: 'callcenter:guidance.outcome.fired',
      params: {},
    })

  // Something else took it. Named, because the caller is about to be told a
  // figure that belongs to a different offer. Where more than one fired, the
  // banner names the engine's own first — the receipt is where all of them are,
  // and a banner listing several is a banner nobody reads mid-call.
  if (newlyFired.length > 0)
    return outcome(add, 'firedOther', newlyFired[0].description ?? '', null, 0, {
      key: 'callcenter:guidance.outcome.firedOther',
      params: {},
    })

  // Nothing fired. The offer stays and its meter moves — which is the outcome
  // the card must NOT answer by disappearing.
  const was = missOf(before, add.offerId)
  const now = missOf(after, add.offerId)
  const progress = was && now ? { from: was, to: now } : null
  const stillNeeds = now ? Math.max(0, now.need - now.have) : 0
  return outcome(
    add,
    'didNotFire',
    descriptionOf(after, add.offerId) || descriptionOf(before, add.offerId),
    progress,
    stillNeeds,
    stillNeeds > 0
      ? { key: 'callcenter:guidance.outcome.didNotFire', params: { count: stillNeeds } }
      : // The offer did not fire and the projection no longer says what it needs
        // — it may have dropped out of the list entirely. Still said out loud:
        // the agent pressed something, and the basket moved without the offer.
        { key: 'callcenter:guidance.outcome.didNotFirePlain', params: {} },
  )
}

function outcome(
  add: GuidanceAdd,
  kind: AddOutcomeKind,
  offerDescription: string,
  progress: AddOutcome['progress'],
  stillNeeds: number,
  phrase: GuidancePhrase,
): AddOutcome {
  return { kind, offerId: add.offerId, itemNumber: add.itemNumber, itemName: add.itemName, offerDescription, progress, stillNeeds, phrase }
}

/** One offer's meter in a state, clamped exactly as the strip clamps it — a
 *  projection that says 4 of 2 is a full meter, not two extra pips. */
function missOf(state: SessionState, offerId: string): { have: number; need: number } | null {
  const miss = (state.nearMisses ?? []).find((entry) => entry.offerId === offerId)
  const need = miss?.progress?.need
  const have = miss?.progress?.have
  if (typeof need !== 'number' || !Number.isFinite(need) || need <= 0) return null
  const held = typeof have === 'number' && Number.isFinite(have) ? have : 0
  return { have: Math.max(0, Math.min(held, need)), need }
}

const descriptionOf = (state: SessionState, offerId: string): string =>
  (state.nearMisses ?? []).find((entry) => entry.offerId === offerId)?.description ?? ''
