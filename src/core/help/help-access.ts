/**
 * Whether the reader holds the access an article's features need (oms 951, BackOffice spec 4182 §D), read off the one
 * permissions answer through the existing Analytics predicates — view, author, curate, SQL. The article stays readable
 * either way; this only picks the badge's sentence ("You have this access" / "Ask your administrator for … access").
 */
import { canAuthorAnalytics, canCurateAnalytics, canSqlAnalytics, canViewAnalytics } from '@/core/analytics-access'
import type { Permissions } from '@/core/permissions'
import type { HelpAccess } from '@/core/models/help'

const HOLDS: Record<HelpAccess, (p: Permissions) => boolean> = {
  viewer: canViewAnalytics,
  author: canAuthorAnalytics,
  curator: canCurateAnalytics,
  sql: canSqlAnalytics,
}

/** True when `p` grants `access`. Fails closed: a pending or failed answer holds nothing. */
export const helpAccessHeld = (access: HelpAccess, p: Permissions): boolean => HOLDS[access](p)
