/**
 * A store page's tabs (oms 941, BackOffice spec 4157 story 14) — pure. The open tab is the address's `tab`; only it is
 * mounted, so only it reads. Switching tab writes the tab alone: each tab has its own boxes, so the new one opens on
 * "Nothing is read yet". 941 builds Items and Batches; 942 Holds, Takes, Feeds and Stage; 945 SAP movements.
 */

export const STORE_TABS = ['items', 'holds', 'batches', 'takes', 'sap', 'feeds', 'stage'] as const
export type StoreTab = (typeof STORE_TABS)[number]

/** The open tab: the address's, or Items when it names none or one this page does not have. */
export const resolveStoreTab = (param: string | null): StoreTab =>
  STORE_TABS.find((t) => t === param) ?? STORE_TABS[0]

/** The address a tab switch writes: the tab, and nothing of the tab left behind. */
export const tabParams = (tab: StoreTab): URLSearchParams => new URLSearchParams({ tab })
