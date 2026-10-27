/**
 * The document type page's tab, held in the URL as `tab` (ticket 3152). Settings is the default and writes no key;
 * History writes `tab=history`. Pure. The serving-list `tab.ts` shape.
 */
export const DOC_TYPE_TABS = ['settings', 'history'] as const
export type DocTypeTab = (typeof DOC_TYPE_TABS)[number]

export function docTypeTabFromParams(params: URLSearchParams): DocTypeTab {
  const v = params.get('tab')
  return (DOC_TYPE_TABS as readonly (string | null)[]).includes(v) ? (v as DocTypeTab) : 'settings'
}

/** A fresh address for a tab: no key for Settings. */
export function docTypeTabParams(tab: DocTypeTab): URLSearchParams {
  return tab === 'settings' ? new URLSearchParams() : new URLSearchParams({ tab })
}
