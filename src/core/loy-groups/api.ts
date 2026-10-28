/**
 * The loyalty-groups doors (BackOffice spec 3173; doors 3174 list, 3179 `liveBonusBuys`). In `@/core/`
 * from the start: the Loyalty groups screen, bonus-buy maintenance (636), simulation (637) and the member
 * screen (635) all read the probe and the list, and a feature may never import another.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 *
 * ⚠️ **No door is deployed yet** — every envelope is stubbed (`tools/loy-groups-drive.mjs`).
 */
import { api } from '@/core/api'
import type { LoyGroup, LoyGroupAccess, LoyGroupBonusBuy } from '@/core/models/loy-groups'

/** The ONE cache key the menu leaf, the screen's gate and every later consumer share. */
export const LOY_GROUPS_ACCESS_KEY = ['loy', 'groups', 'access'] as const

/** The groups list, keyed by its one parameter so Active and All are two cache entries. */
export const loyGroupsKey = (includeInactive: boolean) => ['loy', 'groups', 'list', { includeInactive }] as const

const isObject = (r: unknown): r is Record<string, unknown> => typeof r === 'object' && r !== null && !Array.isArray(r)

/** View — the menu leaf and the screen's `ScreenGate`. Only an explicit `true` grants. */
export const canViewLoyGroups = (r: LoyGroupAccess | null | undefined): boolean => isObject(r) && r.canView === true

/** Maintain — every write control. 🚩 Anchored on view: maintain without view is nothing. */
export const canMaintainLoyGroups = (r: LoyGroupAccess | null | undefined): boolean =>
  canViewLoyGroups(r) && (r as LoyGroupAccess).canMaintain === true

export const loyGroupsApi = {
  /**
   * `GET LoyGroupWeb/Access` → `{ canView, canMaintain }`.
   * 🚩 Fails closed: no 404-tolerant catch — a pending, errored, 403 or malformed probe hides the leaf.
   */
  access(): Promise<LoyGroupAccess> {
    return api.get<LoyGroupAccess>('LoyGroupWeb/Access')
  },
  /** `GET LoyGroupWeb/Groups?includeInactive=bool` → every group (active only unless asked). */
  groups(includeInactive: boolean): Promise<LoyGroup[]> {
    return api.get<LoyGroup[]>('LoyGroupWeb/Groups', { includeInactive })
  },
}

/** The one set of options every reader of the probe passes: a refusal is an answer, not an outage. */
export function loyGroupsAccessQuery() {
  return {
    queryKey: LOY_GROUPS_ACCESS_KEY,
    queryFn: () => loyGroupsApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
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
  const blank = (s: string | null | undefined) => (s ?? '').trim() === ''
  const [first, other] = lang.startsWith('ar') ? [g.nameAr, g.nameEn] : [g.nameEn, g.nameAr]
  if (!blank(first)) return first
  return blank(other) ? '' : other
}

/** The live bonus-buys naming the group; `[]` when the door has not filled them (3179) or sent none. */
export const liveBonusBuysOf = (g: Pick<LoyGroup, 'liveBonusBuys'>): LoyGroupBonusBuy[] =>
  Array.isArray(g.liveBonusBuys) ? g.liveBonusBuys : []
