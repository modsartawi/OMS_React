import type { OrderGuardState } from './guard-check'

// An OMS order's guard state, and the two grants the guard dialog reads (oms ticket 616). Pure.
//
// The two grants (`INS_GUARD`, "the release grant") are not `BackOfficeScreen` keys, so the one permissions answer
// (oms 909, BackOffice spec 4002 row 43) cannot carry them: both stay constant `false` — denied, as they always read —
// until a BackOffice ticket adds them to its `extras`.

/** Whether the order waits on its guard check: an action is needed, or the check is pending. */
export const guardHeld = (state: OrderGuardState | null | undefined): boolean => state === 'actionNeeded' || state === 'pending'

/** `INS_GUARD`: an OVERRIDE may be answered. Not in the answer yet: always denied. */
export const canOverrideGuard = (): boolean => false

/** The release grant: an order held for a guard check may be released. Not in the answer yet: always denied. */
export const canReleaseGuardHold = (): boolean => false
