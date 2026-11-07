import type { HybrisStockAccessResult } from '@/core/models/hybris-stock'

// The Hybris stock probe's two flags (spec 3447 stories 53–54; ticket 847). Pure: no React, no `t`.
//
// Every Hybris stock leaf and page reads its grant through a predicate here, so a nav leaf and its
// screen can never disagree. Manage implies view (spec 3447 "Grants").

/**
 * The two grants as plain booleans. 🚩 Only an explicit `true` grants — an absent flag, a missing
 * answer or a malformed value (`"true"`, `1`) reads as `false`, so the probe fails closed.
 */
export function hybrisStockGrants(r: Partial<HybrisStockAccessResult> | null | undefined): HybrisStockAccessResult {
  const record = (typeof r === 'object' && r !== null ? r : {}) as Partial<Record<keyof HybrisStockAccessResult, unknown>>
  const canManage = record.canManage === true
  return { canView: canManage || record.canView === true, canManage }
}

/** The pages: stores, materials, pushes. */
export const canViewHybrisStock = (r: HybrisStockAccessResult | null | undefined): boolean => hybrisStockGrants(r).canView

/** Mark / unmark, material edits and uploads, push now. */
export const canManageHybrisStock = (r: HybrisStockAccessResult | null | undefined): boolean => hybrisStockGrants(r).canManage
