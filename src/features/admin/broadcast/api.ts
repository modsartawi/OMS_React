import { api } from '@/core/api'
import type { Permissions } from '@/core/permissions'
import type {
  CreateNotificationRequest,
  CreateNotificationResult,
} from '@/core/models/notifications'

// The Send Broadcast screen's server calls (api-envelope rule: all through
// @/core/api). A broadcast is a POST Notifications create with TypeCode=BROADCAST
// and an All/Store audience. The server stays the authority on who may broadcast
// (the NotificationBroadcast grant): a lost grant surfaces as a business refusal
// with code NC_FORBIDDEN, which the screen shows via apiErrorMessage.

/**
 * May broadcast (oms 909, BackOffice spec 4002 Broadcast row): the `NotificationBroadcast:01` grant AND the
 * notification center switched on (`extras.notificationCenterOn` — the create route is mapped only then). Off the one
 * permissions answer; the menu leaf and the page read this one predicate. The old 404-tolerant probe is gone.
 */
export const canBroadcast = (p: Permissions): boolean =>
  p.has('NotificationBroadcast:01') && p.extras.notificationCenterOn

export const broadcastApi = {
  create(request: CreateNotificationRequest): Promise<CreateNotificationResult> {
    return api.post<CreateNotificationResult>('Notifications', request)
  },
}
