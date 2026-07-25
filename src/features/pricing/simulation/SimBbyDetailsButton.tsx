import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'

/**
 * `Bonus buy details ▸` — the promotion card's one route out of the screen (ticket 118,
 * spec 110). It opens the bonus-buy record as a MODAL IN PLACE: the single principled
 * exception to this screen's expand-in-place rule, earned because what it opens is
 * another record, from another endpoint, behind another grant.
 *
 * Three things about its shape are rules rather than taste:
 *
 * **It is not a chip.** No chip on this screen is ever clickable — that is what makes
 * "a chip is a readout" enforceable at a glance — so the control is a full-width footer
 * row, visibly a button, and never borrows the chip treatment.
 *
 * **It is last on the card, below the amount.** The card's answer is what fired (or
 * nearly did) and what it saved; the rules behind it are the follow-up question, so the
 * control sits under the answer rather than competing with it.
 *
 * **It is rendered only where a caller passes `onOpen`.** The gate is the caller's
 * (`probed && screenAllowed` — see `SimulationPage`), not this component's: an unknown
 * grant must mean ABSENT here, and the cheapest way to guarantee that is for the
 * ungranted case to have no callback to render against.
 */
export default function SimBbyDetailsButton({
  bbyNumber,
  onOpen,
}: {
  bbyNumber: string
  onOpen: (bbyNumber: string) => void
}) {
  const { t } = useTranslation('simulation')

  return (
    <button
      type="button"
      data-bby-details={bbyNumber}
      onClick={() => onOpen(bbyNumber)}
      className="flex w-full items-center gap-1 rounded-b-lg border-t border-border/60 px-3 py-1.5 text-start text-[11px] font-semibold text-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {t('promo.bbyDetails')}
      <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
    </button>
  )
}
