/**
 * The action types page's address (ticket 3155): `category` is the document category shown (blank until one is
 * picked), `tab` its open tab — Action types is the default and writes no key; History writes `tab=history`. Pure.
 */
export const ACTION_TYPES_TABS = ['actionTypes', 'history'] as const
export type ActionTypesTab = (typeof ACTION_TYPES_TABS)[number]

export interface ActionTypesView {
  category: string
  tab: ActionTypesTab
}

export function actionTypesViewFromParams(params: URLSearchParams): ActionTypesView {
  const tab = params.get('tab')
  return {
    category: (params.get('category') ?? '').trim(),
    tab: (ACTION_TYPES_TABS as readonly (string | null)[]).includes(tab) ? (tab as ActionTypesTab) : 'actionTypes',
  }
}

/** A fresh address for a view: no key for a blank category or the default tab. */
export function actionTypesParams(view: ActionTypesView): URLSearchParams {
  const params = new URLSearchParams()
  if (view.category) params.set('category', view.category)
  if (view.tab !== 'actionTypes') params.set('tab', view.tab)
  return params
}
