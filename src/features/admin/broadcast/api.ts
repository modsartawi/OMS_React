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

/**
 * The compose access probe's normalized result (038). `allowed` = the server says
 * the caller holds NotificationBroadcast[01].
 */
export interface BroadcastAccessResult {
  allowed: boolean
}

/** Raw wire shape of GET Notifications/Access. */
interface BroadcastAccessWire {
  canBroadcast: boolean
}

export const broadcastApi = {
  create(request: CreateNotificationRequest): Promise<CreateNotificationResult> {
    return api.post<CreateNotificationResult>('Notifications', request)
  },

  // Screen-open grant probe. Drives BOTH the shell's permission-aware nav hiding
  // AND the page's own route-guard (shared ['broadcast','access'] cache key → one
  // call). 🚩 FAILS CLOSED (oms 852): the route is mapped only while the
  // notification center is on, so a 404 means nothing about the grant — it now
  // rejects like any other failure and the nav hides the leaf, instead of the old
  // "unknown → allowed". BackOffice 3459 makes it always answer.
  access(): Promise<BroadcastAccessResult> {
    return api
      .get<BroadcastAccessWire>('Notifications/Access')
      .then((r) => ({ allowed: r?.canBroadcast === true }))
  },
}
