import type { OmsAccessResult } from '@/core/models/oms-access'
import type { OrderGuardState } from './guard-check'

// An OMS order's guard state, and the two grants the guard dialog reads (oms ticket 616). Pure.
//
// GUESS (618 reconciles): the brief names the grants (`INS_GUARD`, "the release grant") but no probe for
// them. They are read as two more optional flags of the OMS probe the Delivery details page already reads
// (`GET SdDocumentWeb/Access`): `canOverrideGuard` and `canReleaseGuardHold`. Absent reads as denied.

/** Whether the order waits on its guard check: an action is needed, or the check is pending. */
export const guardHeld = (state: OrderGuardState | null | undefined): boolean => state === 'actionNeeded' || state === 'pending'

type Grants = Pick<OmsAccessResult, 'canOverrideGuard' | 'canReleaseGuardHold'>

/** `INS_GUARD`: an OVERRIDE may be answered. Only an explicit `true` grants. */
export const canOverrideGuard = (r: Partial<Grants> | null | undefined): boolean => r?.canOverrideGuard === true

/** The release grant: an order held for a guard check may be released. Only an explicit `true` grants. */
export const canReleaseGuardHold = (r: Partial<Grants> | null | undefined): boolean => r?.canReleaseGuardHold === true
