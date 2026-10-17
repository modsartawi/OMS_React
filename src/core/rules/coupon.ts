import type { RuleCouponStatus } from '@/core/models/rule-campaign'
import type { Severity } from '@/core/ui/severity'

// A campaign coupon's shared readings: a campaign's coupons (515) and the coupon finder (519) both
// need them, so they live here rather than in either feature.

/** A coupon's status as a badge's severity. */
export const COUPON_STATUS_SEV: Record<RuleCouponStatus, Severity> = { unused: 'go', used: 'ok', disabled: 'mute', expired: 'mute' }

/** A code as it is kept: upper-case, no spaces — what Create coupons writes and the finder asks. */
export const cleanCode = (value: string): string => value.toUpperCase().replace(/\s/g, '')
