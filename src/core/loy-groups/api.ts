/**
 * The loyalty-groups doors (BackOffice spec 3173; doors 3174 list, 3179 `liveBonusBuys`). In `@/core/`
 * from the start: the Loyalty groups screen, bonus-buy maintenance (636), simulation (637) and the member
 * screen (635) all read the list, and a feature may never import another. The grants come off the one
 * permissions answer (`@/core/permissions`, oms 909).
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 *
 * ⚠️ **No door is deployed yet** — every envelope is stubbed (`tools/loy-groups-drive.mjs`).
 */
import { api } from '@/core/api'
import { localizedName } from '@/core/util/localized-name'
import type { LoyGroup, LoyGroupBonusBuy } from '@/core/models/loy-groups'
import type { Permissions } from '@/core/permissions'

/** The groups list, keyed by its one parameter so Active and All are two cache entries. */
export const loyGroupsKey = (includeInactive: boolean) => ['loy', 'groups', 'list', { includeInactive }] as const

/** View (`LoyaltyGroup:03`) — the menu leaf and the screen's `ScreenGate`. */
export const canViewLoyGroups = (p: Permissions): boolean => p.has('LoyaltyGroup:03')

/** Maintain (`LoyaltyGroup:02`) — every write control. 🚩 Anchored on view: maintain without view is nothing. */
export const canMaintainLoyGroups = (p: Permissions): boolean => canViewLoyGroups(p) && p.has('LoyaltyGroup:02')

export const loyGroupsApi = {
  /** `GET LoyGroupWeb/Groups?includeInactive=bool` → every group (active only unless asked). */
  groups(includeInactive: boolean): Promise<LoyGroup[]> {
    return api.get<LoyGroup[]>('LoyGroupWeb/Groups', { includeInactive })
  },
}

export function loyGroupsQuery(includeInactive: boolean) {
  return {
    queryKey: loyGroupsKey(includeInactive),
    queryFn: () => loyGroupsApi.groups(includeInactive),
  } as const
}

/**
 * The group's name in the UI language — the Arabic name under Arabic, **as stored** (no trim, no digit
 * folding) — falling back to the other language's when that one is blank.
 */
export function loyGroupName(g: Pick<LoyGroup, 'nameEn' | 'nameAr'>, lang: string): string {
  return localizedName(g, lang)
}

/** The live bonus-buys naming the group; `[]` when the door has not filled them (3179) or sent none. */
export const liveBonusBuysOf = (g: Pick<LoyGroup, 'liveBonusBuys'>): LoyGroupBonusBuy[] =>
  Array.isArray(g.liveBonusBuys) ? g.liveBonusBuys : []
