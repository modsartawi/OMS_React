/**
 * The held-stock reports' grant (BackOffice ticket 3873), read off the one permissions answer (oms 914). Both reports
 * share it, so both leaves and every page read this predicate.
 */
import type { Permissions } from '@/core/permissions'

/** `HeldStockReport:03` — the menu leaves' and the pages' gates' one predicate. */
export const canOpenHeldStockReport = (p: Permissions): boolean => p.has('HeldStockReport:03')
