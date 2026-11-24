/**
 * The parked-returns grants (BackOffice ticket 4224, spec 4212), read off the ONE permissions answer (oms 914). BackOffice
 * 4218 seeds the CONTROLLER `ParkedReturns`: 03 view (`ParkedReturns.View`, the list and the detail), 06 settle
 * (`ParkedReturns.Settle`: the actions, pay in cash and rule-return un-park — later tickets').
 *
 * These are the same rights `GET RefundLedgerWeb/Access` answers as `{ canView, canSettle }`; reading them off the one
 * permissions answer keeps the shell at one call (oms 914 retired the per-area `*\/Access` probes).
 */
import type { Permissions } from '@/core/permissions'

/** `ParkedReturns:03` (`canView`): the Returns area, the list, the detail drawer. */
export const canViewParkedReturns = (p: Permissions): boolean => p.has('ParkedReturns:03')

/** `ParkedReturns:06` (`canSettle`): the settle actions and Resolve row-less in the detail drawer (ticket 4225). */
export const canSettleParkedReturns = (p: Permissions): boolean => p.has('ParkedReturns:06')
