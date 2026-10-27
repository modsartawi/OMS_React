/**
 * The Loyalty groups screen's own doors — the ones no other feature reads. The shared doors (probe,
 * list) live in `@/core/loy-groups/api`. Through `@/core/api` like every call
 * (`.claude/rules/api-envelope.md`).
 *
 * ⚠️ No door is deployed yet — every envelope is stubbed (`tools/loy-groups-drive.mjs`).
 */
import { api } from '@/core/api'
import type { LoyGroupCreateRequest, LoyGroupDetail, LoyGroupRenameRequest, LoyMobileGroup } from '@/core/models/loy-groups'

// ── Mobile → groups lookup (oms ticket 634; door BackOffice 3176) ───────────────────────────────

/** The URL param the typed mobile sits in, so a refresh repeats the search. */
export const LOOKUP_MOBILE_PARAM = 'mobile'

/** The mobile being looked up, from the URL — trimmed, `''` when none. */
export const lookupMobileOf = (params: URLSearchParams): string => (params.get(LOOKUP_MOBILE_PARAM) ?? '').trim()

/**
 * `LoyGroupWeb/Mobile/{mobile}/Groups`. The mobile is sent in the spelling the user typed (the server
 * takes any spelling and canonicalises it), encoded as ONE path segment so a `+`, a space or a `/` can
 * neither cut the path nor start a query.
 */
export const mobileGroupsPath = (mobile: string): string => `LoyGroupWeb/Mobile/${encodeURIComponent(mobile)}/Groups`

export const loyGroupLookupApi = {
  /** `GET LoyGroupWeb/Mobile/{mobile}/Groups` → every group the mobile is in, active and inactive. */
  groupsOf(mobile: string): Promise<LoyMobileGroup[]> {
    return api.get<LoyMobileGroup[]>(mobileGroupsPath(mobile))
  },
}

/** Keyed by the mobile as typed; a not-a-mobile refusal is an answer, so it is not retried. */
export function mobileGroupsQuery(mobile: string) {
  return {
    queryKey: ['loy', 'groups', 'mobile', mobile] as const,
    queryFn: () => loyGroupLookupApi.groupsOf(mobile),
    enabled: mobile !== '',
    retry: false,
  } as const
}

// ── Group editor (oms ticket 630; doors BackOffice 3174) ─────────────────────────────────────

/** One group's page, under the shared `['loy', 'groups', …]` prefix so a write can invalidate both. */
export const loyGroupKey = (groupId: string) => ['loy', 'groups', 'one', groupId] as const

export const groupsApi = {
  /** `GET LoyGroupWeb/Groups/{groupId}` → the group plus created/updated by/at. */
  group(groupId: string): Promise<LoyGroupDetail> {
    return api.get<LoyGroupDetail>(`LoyGroupWeb/Groups/${encodeURIComponent(groupId)}`)
  },
  /** `POST LoyGroupWeb/Groups/Create` → the new group. Refuses a bad or duplicate code, a name over width. */
  create(body: LoyGroupCreateRequest): Promise<LoyGroupDetail> {
    return api.post<LoyGroupDetail>('LoyGroupWeb/Groups/Create', body)
  },
  /** `POST LoyGroupWeb/Groups/Rename` — names only; the code never changes. */
  rename(body: LoyGroupRenameRequest): Promise<LoyGroupDetail> {
    return api.post<LoyGroupDetail>('LoyGroupWeb/Groups/Rename', body)
  },
}
