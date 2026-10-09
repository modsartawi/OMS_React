import type { MaterialAccessResult } from '@/core/models/materials'

// The Materials probe's three flags (spec 2544, ticket 451). Pure: no React, no `t`.
//
// Each leaf of the Materials menu group and each page's in-page gate read their flag through the
// SAME predicate here, so a nav and a screen can never disagree about a grant.

/** The three flags, in the contract's order. */
export const MATERIAL_FLAGS = ['canSearchMaterials', 'canCheckStock', 'canCheckGs1'] as const

export type MaterialFlag = (typeof MATERIAL_FLAGS)[number]
export type MaterialGrants = Record<MaterialFlag, boolean>

/**
 * Every flag as a plain boolean. 🚩 Only an explicit `true` grants: an absent flag, a missing
 * answer or a malformed value (`"true"`, `1`, an array from a stub that never heard of the door)
 * all read as `false`, so the probe keeps failing closed.
 */
export function materialGrants(r: Partial<MaterialAccessResult> | null | undefined): MaterialGrants {
  const record = (typeof r === 'object' && r !== null ? r : {}) as Partial<Record<MaterialFlag, unknown>>
  return Object.fromEntries(MATERIAL_FLAGS.map((flag) => [flag, record[flag] === true])) as MaterialGrants
}

/** Material search + detail — the search leaf's and both pages' one predicate. */
export const canSearchMaterials = (r: MaterialAccessResult | null | undefined): boolean =>
  materialGrants(r).canSearchMaterials

/** Stock check — its leaf, its page, and "check stock for selected" on the search page. */
export const canCheckStock = (r: MaterialAccessResult | null | undefined): boolean =>
  materialGrants(r).canCheckStock

/** GS1 check — its leaf's and its page's one predicate. */
export const canCheckGs1 = (r: MaterialAccessResult | null | undefined): boolean =>
  materialGrants(r).canCheckGs1

/** The detail's Stock tab needs BOTH the search grant and the stock grant (spec 2544, Grants). */
export const canSeeMaterialStock = (r: MaterialAccessResult | null | undefined): boolean => {
  const g = materialGrants(r)
  return g.canSearchMaterials && g.canCheckStock
}
