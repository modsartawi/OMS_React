import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/core/api'
import type { AnalyticsAudienceCandidates, AnalyticsAudienceRole, AnalyticsAudienceUser } from '@/core/models/analytics'
import { readCandidates } from './audience'

/** `GET Analytics/AudienceCandidates` — a report's (833) carry each user's address, run grant and audience. */
export const analyticsAudienceCandidatesKey = (search: string, reportId?: string) => ['analytics', 'audienceCandidates', search, ...(reportId ? [reportId] : [])] as const

/**
 * 826: `GET Analytics/AudienceCandidates` with `search` (a name or an employee id) — up to 50 authz roles and
 * analytics users. Moved here with the picker (oms 925), so the boards and the item lists ask through one door.
 */
export async function fetchAudienceCandidates(search: string, reportId?: string): Promise<AnalyticsAudienceCandidates> {
  return readCandidates(await api.get<unknown>('Analytics/AudienceCandidates', { search, reportId }))
}

/**
 * The candidates for what is typed (debounced, like the strip's member picker). Every role and user seen is
 * remembered (`seen`), so a chosen one keeps its words after a search that no longer lists it.
 */
export function useCandidates(seed: { roles: AnalyticsAudienceRole[]; users: AnalyticsAudienceUser[] }, enabled = true, reportId?: string) {
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setSearch(typed.trim()), 250)
    return () => clearTimeout(id)
  }, [typed])
  const query = useQuery({
    queryKey: analyticsAudienceCandidatesKey(search, reportId),
    queryFn: () => fetchAudienceCandidates(search, reportId),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
    enabled,
  })
  const seen = useRef({ roles: new Map(seed.roles.map((r) => [r.key, r])), users: new Map(seed.users.map((u) => [u.id, u])) })
  for (const r of query.data?.roles ?? []) seen.current.roles.set(r.key, r)
  for (const u of query.data?.users ?? []) seen.current.users.set(u.id, u)
  return { data: query.data, loading: query.isFetching, failed: !!query.error, setTyped, seen: seen.current }
}
