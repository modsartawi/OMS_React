/**
 * The Analytics grants, read off the one permissions answer (oms 914, BackOffice spec 4002). In `@/core/` because two
 * features read them — the analytics boards and the copilot's SQL mode toggle — and a feature may not import another.
 *
 * The server's own combinations (brief 3995's predicate table): curate and SQL each sit on the author grant, which sits
 * on view. `canAuthorAnalytics` is the server's `canAuthor` (view and `Analytics:02`); the old client reading
 * "curate implies author" is tightened to it, since the server never holds curate without author.
 */
import type { Permissions } from '@/core/permissions'

/** `Analytics:03` — the menu group, every analytics page's gate. */
export const canViewAnalytics = (p: Permissions): boolean => p.has('Analytics:03')

/** View and `Analytics:02` — the builder and editor routes, New, edit, copy, share and the ask box. */
export const canAuthorAnalytics = (p: Permissions): boolean => canViewAnalytics(p) && p.has('Analytics:02')

/** Author and `Analytics:06` — certify, the status strip, the raw preview. */
export const canCurateAnalytics = (p: Permissions): boolean => canAuthorAnalytics(p) && p.has('Analytics:06')

/** Author and `Analytics:07` — the SQL editor and the copilot's SQL mode. */
export const canSqlAnalytics = (p: Permissions): boolean => canAuthorAnalytics(p) && p.has('Analytics:07')
