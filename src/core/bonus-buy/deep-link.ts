/**
 * The one URL that opens a bonus buy's record from somewhere else in the app.
 *
 * The Bonus Buy Inquiry screen already holds the detail surface — the grid's
 * *Details ▸*, `Bby/Detail`, the SAP-style modal — and nothing about that is
 * worth building a second time. What was missing was an ADDRESS: a screen that
 * has a bonus buy number and no route to what it means (the call-center
 * guidance strip is the first of them) could only tell the agent to go and look
 * it up by hand.
 *
 * 🚩 It lives in `@/core/` with the modal and the calls it opens, for the reason
 * ticket 112 moved those: a feature may never import another feature, and a
 * consumer that spelled `'/pricing/bonus-buy-inquiry?bby='` into its own JSX
 * would be exactly that import, written as a string the router cannot check.
 * One builder, and the screens that link to it never learn the path.
 */

/** The inquiry screen's route — the router's entry, spelled once. */
export const BBY_INQUIRY_PATH = '/pricing/bonus-buy-inquiry'

/** The query parameter the inquiry screen opens its detail modal from. */
export const BBY_DETAIL_PARAM = 'bby'

/**
 * Where a bonus buy number's record lives, or `null` where there is nothing to
 * link to.
 *
 * 🚩 **A blank number has no address, and that is a real state**, not a defensive
 * check: every `BbyHeader.OfferId` in dev master data is blank
 * ([859](C:\Work\DMSCO\BackOffice\.issues\859-near-miss-offer-id-is-blank.md)),
 * so the call-center near-misses that carry this identifier frequently carry
 * nothing. Returning `null` is what lets a caller draw NO control rather than a
 * link to the whole grid — a link that silently landed on an unfiltered list
 * would read as "this bonus buy could not be found".
 */
export function bbyDetailHref(bbyNumber: string | null | undefined): string | null {
  const number = (bbyNumber ?? '').trim()
  if (!number) return null
  return `${BBY_INQUIRY_PATH}?${BBY_DETAIL_PARAM}=${encodeURIComponent(number)}`
}
