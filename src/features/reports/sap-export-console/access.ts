/**
 * The SAP export console's grant (BackOffice spec 2579, ticket 461; oms 909: off the one permissions answer) — apart
 * from `./api` so the Reports menu leaf, which imports it eagerly, costs the main bundle only this.
 */
import type { Permissions } from '@/core/permissions'

/**
 * The one predicate, read by BOTH the nav leaf and the page's gate: `SapExportConsole:03`. Its own grant, not the
 * IDoc inspector's, though they share an area.
 */
export const canOpenSapExport = (p: Permissions): boolean => p.has('SapExportConsole:03')
