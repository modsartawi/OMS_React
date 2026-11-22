/**
 * Whether the reader holds the access an article's features need (oms 951, BackOffice spec 4182 §D), read off the one
 * permissions answer through the existing Analytics predicates — view, author, curate, SQL. The article stays readable
 * either way; this only picks the badge's sentence ("You have this access" / "Ask your administrator for … access").
 */
import { canAuthorAnalytics, canCurateAnalytics, canSqlAnalytics, canViewAnalytics } from '@/core/analytics-access'
import type { Permissions } from '@/core/permissions'
import { HELP_ACCESS, type HelpAccess } from '@/core/models/help'

const HOLDS: Record<HelpAccess, (p: Permissions) => boolean> = {
  viewer: canViewAnalytics,
  author: canAuthorAnalytics,
  curator: canCurateAnalytics,
  sql: canSqlAnalytics,
}

/** One of the four levels the app knows — the server may send another (review 4182 #1). */
export const isHelpAccess = (access: unknown): access is HelpAccess => (HELP_ACCESS as readonly unknown[]).includes(access)

/** True when `p` grants `access`. Fails closed: a pending or failed answer, or a level the app does not know, holds nothing. */
export const helpAccessHeld = (access: HelpAccess, p: Permissions): boolean => isHelpAccess(access) && HOLDS[access](p)

/**
 * Who reads the analytics help at all: "wherever the Analytics menu shows" — an Analytics viewer, or a PriceWatch viewer
 * (`PriceWatch:03`, the price command center's view grant). The Help menu leaf and the copilot's "How do I…?" row
 * (review 4182 #8) read this one predicate.
 */
export const canReadHelp = (p: Permissions): boolean => canViewAnalytics(p) || p.has('PriceWatch:03')
