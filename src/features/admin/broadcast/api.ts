import { api, ApiError } from '@/core/api'
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
 * the caller holds NotificationBroadcast[01]. `probed` = the endpoint answered
 * (false ⇒ it's absent/404 ⇒ unknown ⇒ degrade to server authority: show the
 * screen and let Create refuse with NC_FORBIDDEN if the grant is missing).
 */
export interface BroadcastAccessResult {
  allowed: boolean
  probed: boolean
}

/** Raw wire shape of GET Notifications/Access (provisional — backend TBD; mirrors
 *  the Sessions/Access / Pricing/Access `{ canOpen }` probe pattern). */
interface BroadcastAccessWire {
  canBroadcast: boolean
}

export const broadcastApi = {
  create(request: CreateNotificationRequest): Promise<CreateNotificationResult> {
    return api.post<CreateNotificationResult>('Notifications', request)
  },

  // Screen-open grant probe. Drives BOTH the shell's permission-aware nav hiding
  // AND the page's own route-guard (shared ['broadcast','access'] cache key → one
  // call). ⚠️ GET Notifications/Access does NOT exist in SIS.Api yet — a 404 is
  // caught and mapped to "unknown → allowed" so the feature degrades gracefully
  // (nav shown, server stays authoritative) until the endpoint ships.
  access(): Promise<BroadcastAccessResult> {
    return api
      .get<BroadcastAccessWire>('Notifications/Access')
      .then((r) => ({ allowed: r.canBroadcast === true, probed: true }))
      .catch((err) => {
        if (err instanceof ApiError && err.statusCode === 404)
          return { allowed: true, probed: false }
        throw err
      })
  },
}
