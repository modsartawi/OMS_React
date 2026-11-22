/**
 * An item page's tabs (oms 943, BackOffice spec 4157 stories 56–60) — pure. The open tab is the address's `tab`; only
 * it is mounted, so only it reads (each is one small read on opening). Switching writes the tab alone.
 *
 * Ticket 945 adds Movements by appending `'movements'` here and its panel to `ItemTabs`' `PANELS` (the type asks for it).
 */

export const ITEM_TABS = ['batches', 'holds', 'takes', 'stores'] as const
export type ItemTab = (typeof ITEM_TABS)[number]

/** The open tab: the address's, or Batches when it names none or one this page does not have. */
export const resolveItemTab = (param: string | null): ItemTab => ITEM_TABS.find((t) => t === param) ?? ITEM_TABS[0]

/** The address a tab switch writes: the tab, and nothing of the tab left behind. */
export const itemTabParams = (tab: ItemTab): URLSearchParams => new URLSearchParams({ tab })

/** A store list's columns on the item's page: the item and its name are the page's own, so their columns go. */
export const withoutItemColumns = <C extends { field?: unknown; colId?: string }>(columns: C[]): C[] =>
  columns.filter((c) => c.field !== 'item' && c.colId !== 'item' && c.colId !== 'name')
