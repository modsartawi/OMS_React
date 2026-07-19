import { api } from '@/core/api'
import type { NotificationPollResult } from '@/core/models/notifications'

// The Notification Center is Receive chrome that rides the AppShell (spec 031:
// feature-structure places the bell/panel/poll in `layout/`, not a `features/`
// screen — the poll must run portal-wide regardless of route). All calls go
// through `@/core/api` (api-envelope rule); the envelope is unwrapped by
// `request()`. Identity is carried by the existing session (cookie + X-Web-Client)
// which the server resolves to a BackOffice User+All caller — NO new identity
// headers, and the client must NOT send x-api-key.
export const notificationsApi = {
  // Poll the active audience set as a delta since `watermark` (0 = cold start =
  // full set). `x-presence: skip` is a cooperative throttle telling the server to
  // skip its presence heartbeat write — presence is ops-only and nothing here
  // branches on it. A 404 means NotificationCenter:Enabled is off server-side
  // (the routes are never mapped) — the caller treats that as "feature off", not
  // an error.
  poll(watermark: number): Promise<NotificationPollResult> {
    return api.get<NotificationPollResult>(
      'Notifications/Poll',
      { watermark },
      { 'x-presence': 'skip' },
    )
  },
}
