/**
 * The store page's panels (BackOffice spec 4016; oms 916–919), in the page's fixed order. Pure — pinned by
 * `panels.test.ts`.
 *
 * A panel is SHOWN when it is mounted in `panel-views.tsx`: 916 Readings; 917 Live activity, Health check; 918 Space,
 * Backup, Jobs; 919 Restore. A panel whose door needs more than View gates its own controls inside itself.
 */

export const STORE_DB_PANELS = ['readings', 'live', 'health', 'space', 'backup', 'jobs', 'restore'] as const

export type StoreDbPanel = (typeof STORE_DB_PANELS)[number]

/** The mounted panels, in the page's order; a key no panel is known by is dropped. */
export function storeDbPanels(mounted: Iterable<string>): StoreDbPanel[] {
  const on = new Set(mounted)
  return STORE_DB_PANELS.filter((p) => on.has(p))
}

/** The open panel from `?panel=`: one the page shows, else its first. */
export function resolveStoreDbPanel(param: string | null, panels: readonly StoreDbPanel[]): StoreDbPanel {
  return panels.find((p) => p === param) ?? panels[0]
}
