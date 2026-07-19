import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/core/api'
import { notificationsApi } from './api'
import { useNcStore } from './store'

const POLL_INTERVAL_MS = 30_000

// The portal-wide poll. Runs on a TanStack Query `refetchInterval` (parity with
// the Active Sessions live monitor): the interval pauses automatically when the
// tab is hidden (`refetchIntervalInBackground` stays default-false) so an idle
// tab doesn't hammer the server. Each tick reads the in-memory watermark, polls
// the delta, and merges it into the store; a 404 latches the feature-off state
// and stops the interval (the bell then hides). Mounted once, high in the shell.
async function pollOnce(): Promise<number> {
  const { watermark, merge, setDisabled } = useNcStore.getState()
  try {
    const result = await notificationsApi.poll(watermark)
    merge(result)
    return result.watermark
  } catch (err) {
    // 404 ⇒ NotificationCenter:Enabled is off (routes unmapped) — a definite
    // "feature off" signal, not flakiness. Latch it and stop polling; never
    // surface it as an error toast.
    if (err instanceof ApiError && err.statusCode === 404) {
      setDisabled()
      return watermark
    }
    throw err
  }
}

/**
 * Drives the background poll. Returns nothing — consumers read the derived badge
 * and list off `useNcStore`. Stops once the feature is known-off.
 */
export function useNotificationPoll(): void {
  const disabled = useNcStore((s) => s.disabled)
  useQuery({
    queryKey: ['notifications', 'poll'],
    queryFn: pollOnce,
    enabled: !disabled,
    refetchInterval: disabled ? false : POLL_INTERVAL_MS,
    // A transient poll failure shouldn't spam retries; the next interval retries.
    retry: false,
  })
}
