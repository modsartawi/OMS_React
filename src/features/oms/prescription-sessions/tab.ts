/**
 * The HQ prescription-session page's tab, held in the URL as `tab` (ticket 545). Pure.
 *
 * Open (545) is the default and writes no key; To open (546) and Ended (547) write theirs. Each
 * tab owns the rest of the address while it is shown — a switch starts the new tab from
 * `tabParams(tab)` alone, so one tab's filters never leak into another's, and each tab's own
 * `fromParams`/`toParams` (Open: `./open-filter`) must write the `tab` key back when it is not Open.
 */
export const HQ_TABS = ['open', 'toOpen', 'ended'] as const
export type HqTab = (typeof HQ_TABS)[number]

export function tabFromParams(params: URLSearchParams): HqTab {
  const v = params.get('tab')
  return (HQ_TABS as readonly (string | null)[]).includes(v) ? (v as HqTab) : 'open'
}

/** A fresh address for a tab: no key for Open. */
export function tabParams(tab: HqTab): URLSearchParams {
  return tab === 'open' ? new URLSearchParams() : new URLSearchParams({ tab })
}
