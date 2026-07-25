import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RotateCw } from 'lucide-react'

/**
 * The status slot (ticket 114, spec 110) — **the only new component the whole
 * rework adds.** One slot, three states, so staleness and in-flight are one form
 * rather than two separate inventions:
 *
 *   absent    the inputs on screen produced the results on screen — nothing at
 *             all, exactly as a healthy result line carries no mark
 *   stale     any input differs from the request that produced the result
 *   in flight a Process is out
 *
 * It is **deliberately not a chip**: it changes while you read it, which is
 * precisely what the chip test excludes ("a chip is a readout"). So it reads as a
 * different species — a **dashed** neutral pill beside the solid chips.
 *
 * **Neutral by force, not by taste.** The screen's whole hue budget is two
 * (success on a fired promotion, attention on a `W` line — 100 §2), and amber
 * here would break that budget *and* promise a fault where there is none.
 * Nothing is wrong; the screen is simply describing an older basket.
 *
 * **It marks, and does nothing else** — no re-run, no block on Process, no
 * discard of results. All three would be run semantics, outside this rework's
 * scope line.
 */

/** How long an in-flight run may last before it earns a spinner. The captured
 *  runs return in 184–268 ms, so most ordinary runs never show one. */
const SPINNER_DELAY_MS = 150

/**
 * `true` once a run has been out for 150 ms — the delay that keeps an ordinary
 * run from flashing a spinner.
 *
 * It lives here, beside the slot, but the **strip reads it too**: the slot's
 * spinner and the `Processing…` button's spinner are the same waiting, so they
 * are one timer rather than two that can disagree.
 */
export function useSpinnerVisible(pending: boolean): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!pending) {
      setVisible(false)
      return
    }
    const timer = window.setTimeout(() => setVisible(true), SPINNER_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [pending])

  return visible
}

interface Props {
  /** A Process is out — the third state, and it wins over staleness: the run
   *  that is about to answer is more interesting than the one that already did. */
  pending: boolean
  /** The inputs on screen no longer describe the results on screen (`staleness.ts`). */
  stale: boolean
  /** The shared 150 ms flag (`useSpinnerVisible`), so the slot and the Process
   *  button start spinning on the same tick. */
  spinner: boolean
}

/** The dashed neutral pill both non-absent states wear. */
const pill =
  'inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong bg-muted px-2 py-0.5 text-xs text-muted-foreground'

export default function SimStatusSlot({ pending, stale, spinner }: Props) {
  const { t } = useTranslation('simulation')

  if (pending) {
    return (
      // `role="status"` rather than an alert: waiting is not a fault, and a
      // polite live region is what "it changes while you read it" needs.
      <span data-status-slot="processing" role="status" className={pill}>
        {/* The spinner is the only thing the 150 ms gates — the words appear at
            once, because the slot going silent-then-loud would be the flicker
            the delay exists to prevent. */}
        {spinner ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
        {/* One string, two places: the same key labels the disabled Process
            button (spec 110's i18n ledger — `actions.processing`, not a new key). */}
        {t('actions.processing')}
      </span>
    )
  }

  if (stale) {
    return (
      <span data-status-slot="stale" role="status" className={pill}>
        {/* The `↻` is a glyph, not copy — `strip.stale` is the words alone (123).
            A closed refresh circle is direction-independent: it carries no reading
            order to mirror, so it is not one of 121's flipped SVGs. */}
        <RotateCw className="h-3 w-3" aria-hidden />
        {t('strip.stale')}
      </span>
    )
  }

  // Absent — silence is the healthy state. The empty span still holds the slot's
  // place in source order, so the mark can never wrap away from the chips it
  // comments on when it does appear.
  return <span data-status-slot="absent" />
}

/**
 * The stale mark's second appearance: one dashed neutral line **above the
 * results**, so the mark is visible both where the change happened (the strip)
 * and where the stale numbers are (spec 110, story 14).
 *
 * It says the same thing in the same words — `strip.stale` in two places, like
 * `actions.processing` — because a second sentence would be a second vocabulary
 * for one state. It confirms, and confirms **once**: the results themselves stay
 * fully readable and undimmed underneath it.
 */
export function SimStaleResultsNote() {
  const { t } = useTranslation('simulation')
  return (
    <p
      data-stale-note
      // NOT a live region: the slot above already announces the change once, and
      // two polite regions carrying the same sentence would say it twice.
      className="flex items-center gap-1.5 rounded-lg border border-dashed border-border-strong bg-muted px-3 py-1.5 text-xs text-muted-foreground"
    >
      <RotateCw className="h-3 w-3 shrink-0" aria-hidden />
      {t('strip.stale')}
    </p>
  )
}
