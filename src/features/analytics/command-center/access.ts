/**
 * Who may open the Retail Command Center (oms 946, BackOffice spec 4165): the analytics view grant (`Analytics:03`, no
 * new grant), while the server offers it — `CommandCenter:Home`, read off the one permissions answer as
 * `extras.commandCenterOn` the way the broadcast composer reads `notificationCenterOn` (decisions §2). A missing flag is
 * off, so nothing shows until the server switch is on. The menu leaf and the page gate read this one predicate.
 *
 * Not the security boundary: the routes refuse without the grant and are absent with the switch off (BO 4166, 4176).
 */
import { canViewAnalytics } from '@/core/analytics-access'
import type { Permissions } from '@/core/permissions'

/** The leaf's and the page gate's one predicate. */
export const canOpenCommandCenter = (p: Permissions): boolean => canViewAnalytics(p) && p.extras.commandCenterOn

/** The grant is held but the server does not offer the command center: the page is absent (the app's not-found, `./PageFrame`). */
export const commandCenterNotOffered = (p: Permissions): boolean => canViewAnalytics(p) && !p.extras.commandCenterOn
