import { api } from '@/core/api'
import type { MaterialAccessResult } from '@/core/models/materials'

// The Materials area's access probe (BackOffice spec 2544, ticket 451). It lives in `@/core/`
// rather than with a feature because FOUR features read it — search (451), detail (452), stock
// check (453) and GS1 check (454) — and a feature may never import another
// (.claude/rules/feature-structure.md). The `@/core/oms/api` + `access.ts` shape: one key, one
// call, and a per-leaf predicate per flag in `./access`, so the whole Materials group costs ONE
// network call.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** The ONE cache key the menu leaves and every Materials page share. Exported rather than
 *  re-spelled: a typo in a literal would silently split the cache entry. */
export const MATERIAL_ACCESS_KEY = ['materials', 'access'] as const

export const materialAccessApi = {
  /**
   * GET MaterialWeb/Access → `{ canSearchMaterials, canCheckStock, canCheckGs1 }`.
   *
   * ⚠️ **Fails closed, deliberately** — no 404/network-tolerant catch (the IDoc Inspector
   * precedent): an SIS.Api without the door (BackOffice 2545) answers 404, and a probe that degraded
   * to *shown* while its endpoint was missing would advertise screens nobody can hold the grant for. A rejected promise
   * leaves every Materials leaf hidden (the shell treats pending OR error as hidden) and each page
   * on its denied card.
   */
  access(): Promise<MaterialAccessResult> {
    return api.get<MaterialAccessResult>('MaterialWeb/Access')
  },
}

/**
 * The probe's query options, passed WHOLE by every page gate (react-query merges concurrent
 * observers' options, so one that dropped `retry: false` would retry a refusal). `staleTime:
 * Infinity` because a grant does not change inside a page life.
 */
export function materialAccessQuery() {
  return {
    queryKey: MATERIAL_ACCESS_KEY,
    queryFn: () => materialAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}
