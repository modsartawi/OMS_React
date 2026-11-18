/**
 * The expired approval picks report's grant (BackOffice ticket 3874), read off the one permissions answer (oms 909).
 */
import type { Permissions } from '@/core/permissions'

/** `ExpiredApprovalPick:03` — the menu leaf's and the page gate's one predicate. */
export const canOpenExpiredApprovalPicks = (p: Permissions): boolean => p.has('ExpiredApprovalPick:03')
