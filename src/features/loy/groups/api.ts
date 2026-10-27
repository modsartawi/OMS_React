/**
 * The Loyalty groups screen's OWN doors (oms ticket 630; BackOffice 3174). The probe and the list are
 * shared and live in `@/core/loy-groups/api`; these three are read by this feature only.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 *
 * ⚠️ **No door is deployed yet** — every envelope is stubbed (`tools/loy-groups-drive.mjs`).
 */
import { api } from '@/core/api'
import type { LoyGroupCreateRequest, LoyGroupDetail, LoyGroupRenameRequest } from '@/core/models/loy-groups'

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
