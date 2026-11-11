import type { QueryClient } from '@tanstack/react-query'

/**
 * 886 (BackOffice 3662): the reader's personal schedules (`GET Analytics/MySchedules`) — the "My schedules" page's list
 * and the menu leaf's probe. Here, not in the analytics feature, because the copilot's confirm card (885) saves one too.
 */
export const ANALYTICS_MY_SCHEDULES_KEY = ['analytics', 'mySchedules'] as const

/** 885: a schedule was saved elsewhere (the copilot's Confirm): the list is read again next time it is shown. */
export function rereadMySchedules(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ANALYTICS_MY_SCHEDULES_KEY })
}
