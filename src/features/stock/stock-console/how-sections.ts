/**
 * The paragraphs of each "How this is read" panel (`how.<section>.<p>`), named once so the panel and the locale test
 * agree. 941: the store header, Items, Batches. Later tickets append theirs.
 */
export const HOW_STORE = ['p1', 'p2', 'p3'] as const
export const HOW_ITEMS = ['p1', 'p2', 'p3'] as const
export const HOW_BATCHES = ['p1', 'p2', 'p3'] as const
// 942
export const HOW_HOLDS = ['p1', 'p2', 'p3'] as const
export const HOW_TAKES = ['p1', 'p2', 'p3'] as const
export const HOW_FEEDS = ['p1', 'p2'] as const
export const HOW_STAGE = ['p1', 'p2'] as const
export const HOW_FLEET = ['p1', 'p2', 'p3'] as const
// 943 — the item's sum, one paragraph per line and per rule beside it; each item tab; Find.
export const HOW_ITEM = [
  'sapStock',
  'gap',
  'tillStock',
  'held',
  'reserved',
  'free',
  'answeredNow',
  'changeFeed',
  'otherStock',
] as const
export const HOW_ITEM_BATCHES = ['p1'] as const
export const HOW_ITEM_HOLDS = ['p1'] as const
export const HOW_ITEM_TAKES = ['p1'] as const
export const HOW_ITEM_STORES = ['p1'] as const
export const HOW_FIND = ['p1', 'p2', 'p3'] as const
// 945 — the SAP movements tab (SAP read live) and the item's Movements tab (our own ledger).
export const HOW_SAP = ['p1', 'p2', 'p3'] as const
export const HOW_MOVEMENTS = ['p1', 'p2', 'p3'] as const
