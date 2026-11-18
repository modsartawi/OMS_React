import type { Permissions } from '@/core/permissions'

// The Hybris stock area's grants (spec 3447 stories 53–54; ticket 847; oms 909: off the one permissions answer). Pure:
// no React, no `t`. Every Hybris stock leaf and page reads its grant through a predicate here, so a nav leaf and its
// screen can never disagree. Manage implies view by role (spec 3447 "Grants"), not by a client rule.

/** The pages: stores, materials, pushes — `HybrisStock:03`. */
export const canViewHybrisStock = (p: Permissions): boolean => p.has('HybrisStock:03')

/** Mark / unmark, material edits and uploads, push now — `HybrisStock:06`. */
export const canManageHybrisStock = (p: Permissions): boolean => p.has('HybrisStock:06')
