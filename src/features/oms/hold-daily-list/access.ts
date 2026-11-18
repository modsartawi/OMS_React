/**
 * HQ's daily list of holds that should have ended: its grant (BackOffice ticket 3872), read off the one permissions
 * answer (oms 909).
 */
import type { Permissions } from '@/core/permissions'

/** `HoldDailyList:03` — the menu leaf's and the page gate's one predicate. */
export const canOpenHoldDailyList = (p: Permissions): boolean => p.has('HoldDailyList:03')
