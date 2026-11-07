/**
 * The pin toggle's cache work (ticket 840, BackOffice 3443) — no React, so vitest drives it through a QueryClient.
 *
 * Items carry no pinned flag: whether an item is pinned is read from the ONE Home entry (`ANALYTICS_HOME_KEY`,
 * `Home.pinned`), and a toggle patches that entry at once (optimistic), puts it back when the door refuses, and
 * re-reads Home when the call lands either way. The plural `Analytics/Items/{id}/Pin` door is `./api`'s.
 */
import type { MutationOptions, QueryClient } from '@tanstack/react-query'
import type { AnalyticsHome, AnalyticsItem, AnalyticsPinState } from '@/core/models/analytics'
import { apiErrorCode } from '@/core/api'
import { ANALYTICS_HOME_KEY } from './api'
import { analyticsErrorWords, readItem } from './wire'

/** Whether Home lists the item under Pinned; `null` while Home is not known (the toggle then waits). */
export const isPinned = (home: AnalyticsHome | undefined, id: string): boolean | null => (home ? home.pinned.some((i) => i.id === id) : null)

/** Home with the item pinned (first: last pinned first) or unpinned. Never lists it twice. */
export function withPin(home: AnalyticsHome, item: AnalyticsItem, pinned: boolean): AnalyticsHome {
  const rest = home.pinned.filter((i) => i.id !== item.id)
  return { ...home, pinned: pinned ? [item, ...rest] : rest }
}

/** Any item page's item (a board, a report) as Home lists it: with no definition, so it fits under Pinned. */
export const asListed = (item: Omit<AnalyticsItem, 'definition'>): AnalyticsItem => readItem({ ...item, definition: null })

export interface PinDoors {
  pin: (id: string) => Promise<AnalyticsPinState>
  unpin: (id: string) => Promise<AnalyticsPinState>
}

export interface PinVars {
  item: AnalyticsItem
  pinned: boolean
}

/** The toggle's mutation: `useMutation(pinMutationOptions(queryClient, analyticsApi, toastRefusal))`. */
export function pinMutationOptions(
  queryClient: QueryClient,
  doors: PinDoors,
  onRefused: (err: unknown, vars: PinVars) => void,
): MutationOptions<AnalyticsPinState, unknown, PinVars, { before: AnalyticsHome | undefined }> {
  return {
    mutationFn: ({ item, pinned }) => (pinned ? doors.pin(item.id) : doors.unpin(item.id)),
    onMutate: async ({ item, pinned }) => {
      await queryClient.cancelQueries({ queryKey: ANALYTICS_HOME_KEY })
      const before = queryClient.getQueryData<AnalyticsHome>(ANALYTICS_HOME_KEY)
      if (before) queryClient.setQueryData<AnalyticsHome>(ANALYTICS_HOME_KEY, withPin(before, item, pinned))
      return { before }
    },
    onError: (err, vars, saved) => {
      if (saved?.before) queryClient.setQueryData(ANALYTICS_HOME_KEY, saved.before)
      onRefused(err, vars)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ANALYTICS_HOME_KEY }),
  }
}

/**
 * A refused toggle's words (3437 ruling 13): a pin's own sentence for 404 (the shared one says "view"), else the
 * code's words or the server's message, else "could not be pinned / unpinned".
 */
export function pinRefusalWords(err: unknown, pinned: boolean, t: (key: string) => string): string {
  if (apiErrorCode(err) === 'ANALYTICS-404') return t('pin.notFound')
  return analyticsErrorWords(err, t(pinned ? 'pin.pinFailed' : 'pin.unpinFailed'), t)
}
