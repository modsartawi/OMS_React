import { api } from '@/core/api'
import type {
  CreateNotificationRequest,
  CreateNotificationResult,
} from '@/core/models/notifications'

// The Send Broadcast screen's server calls (api-envelope rule: all through
// @/core/api). A broadcast is a POST Notifications create with TypeCode=BROADCAST
// and an All/Store audience. The server stays the authority on who may broadcast
// (the NotificationBroadcast grant): a lost grant surfaces as a business refusal
// with code NC_FORBIDDEN, which the screen shows via apiErrorMessage.
export const broadcastApi = {
  create(request: CreateNotificationRequest): Promise<CreateNotificationResult> {
    return api.post<CreateNotificationResult>('Notifications', request)
  },
}
