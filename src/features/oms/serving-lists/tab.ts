/**
 * The serving-list detail's tab, held in the URL as `tab` (oms ticket 568). Pure.
 *
 * Members (568) is the default and writes no key; History (571) writes `tab=history`. A switch starts the
 * new tab from `tabParams(tab)` alone, so one tab's filters never leak into the other's; each tab's own
 * `toParams` must write `tab` back when it is not Members.
 */
export const LIST_TABS = ['members', 'history'] as const
export type ListTab = (typeof LIST_TABS)[number]

export function tabFromParams(params: URLSearchParams): ListTab {
  const v = params.get('tab')
  return (LIST_TABS as readonly (string | null)[]).includes(v) ? (v as ListTab) : 'members'
}

/** A fresh address for a tab: no key for Members. */
export function tabParams(tab: ListTab): URLSearchParams {
  return tab === 'members' ? new URLSearchParams() : new URLSearchParams({ tab })
}
