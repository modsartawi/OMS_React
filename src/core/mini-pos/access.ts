/**
 * The Mini POS screens' grants (oms 927, BackOffice spec 4063, doors 4074), read off the one permissions answer (oms 914):
 * `BackOfficeScreen[MiniPosAdmin, 03]` to see, `[MiniPosAdmin, 06]` to change (role `OMS_MINIPOS_ADMIN`, BackOffice
 * `Seed-MiniPos-Admin-Authorization.sql`). In core because three features (assignments, stores, items) and the menu read
 * the same two predicates. Show/hide only: every door checks its grant again. The promoter's own `MiniPos:03` opens none
 * of these.
 */
import type { Permissions } from '@/core/permissions'

/** `MiniPosAdmin:03` — the three screens and their menu leaves. */
export const canViewMiniPos = (p: Permissions): boolean => p.has('MiniPosAdmin:03')

/** `MiniPosAdmin:06` — every add, end, enable, trial role, print and list change. */
export const canManageMiniPos = (p: Permissions): boolean => p.has('MiniPosAdmin:06')
