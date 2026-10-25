import type { HungerStationAccessResult } from '@/core/models/hungerstation'

// The HungerStation probe's three flags (spec 3028, ticket 551). Pure: no React, no `t`.
//
// Each leaf of the HungerStation menu group and each page's in-page gate read their flag through
// the SAME predicate here, so a nav and a screen can never disagree about a grant. The shape is
// Deliverect's (`@/core/deliverect/access`); the flags are this rail's own.

/** The three flags, in the contract's order. */
export const HUNGERSTATION_FLAGS = ['canManageStores', 'canManageCatalog', 'canViewOrders'] as const

export type HungerStationFlag = (typeof HUNGERSTATION_FLAGS)[number]
export type HungerStationGrants = Record<HungerStationFlag, boolean>

/**
 * Every flag as a plain boolean. 🚩 Only an explicit `true` grants: an absent flag, a missing
 * answer or a malformed value (`"true"`, `1`, an array from a stub that never heard of the door)
 * all read as `false`, so the probe keeps failing closed.
 */
export function hungerStationGrants(r: Partial<HungerStationAccessResult> | null | undefined): HungerStationGrants {
  const record = (typeof r === 'object' && r !== null ? r : {}) as Partial<Record<HungerStationFlag, unknown>>
  return Object.fromEntries(HUNGERSTATION_FLAGS.map((flag) => [flag, record[flag] === true])) as HungerStationGrants
}

/** Chains, stores and their stock sync (551–554). */
export const canManageStores = (r: HungerStationAccessResult | null | undefined): boolean => hungerStationGrants(r).canManageStores

/** The HungerStation material list (555). */
export const canManageCatalog = (r: HungerStationAccessResult | null | undefined): boolean => hungerStationGrants(r).canManageCatalog

/** The orders monitor and retry (556). */
export const canViewOrders = (r: HungerStationAccessResult | null | undefined): boolean => hungerStationGrants(r).canViewOrders
