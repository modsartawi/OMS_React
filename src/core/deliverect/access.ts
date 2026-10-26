import type { DeliverectAccessResult } from '@/core/models/deliverect'

// The Deliverect probe's four flags (spec 2615, ticket 477). Pure: no React, no `t`.
//
// Each leaf of the Deliverect menu group and each page's in-page gate read their flag through the
// SAME predicate here, so a nav and a screen can never disagree about a grant.

/** The four flags, in the contract's order. */
export const DELIVERECT_FLAGS = ['canManageStores', 'canManageCatalog', 'canViewOrders', 'canManageTerms'] as const

export type DeliverectFlag = (typeof DELIVERECT_FLAGS)[number]
export type DeliverectGrants = Record<DeliverectFlag, boolean>

/**
 * Every flag as a plain boolean. 🚩 Only an explicit `true` grants: an absent flag, a missing
 * answer or a malformed value (`"true"`, `1`, an array from a stub that never heard of the door)
 * all read as `false`, so the probe keeps failing closed.
 */
export function deliverectGrants(r: Partial<DeliverectAccessResult> | null | undefined): DeliverectGrants {
  const record = (typeof r === 'object' && r !== null ? r : {}) as Partial<Record<DeliverectFlag, unknown>>
  return Object.fromEntries(DELIVERECT_FLAGS.map((flag) => [flag, record[flag] === true])) as DeliverectGrants
}

/** Stores (477), their stock sync (480) and store status (481). */
export const canManageStores = (r: DeliverectAccessResult | null | undefined): boolean =>
  deliverectGrants(r).canManageStores

/** The whitelist and platform exclusions (479). */
export const canManageCatalog = (r: DeliverectAccessResult | null | undefined): boolean =>
  deliverectGrants(r).canManageCatalog

/** The orders monitor (478). */
export const canViewOrders = (r: DeliverectAccessResult | null | undefined): boolean =>
  deliverectGrants(r).canViewOrders

/** Accounts, delivery platforms and their terms (482). */
export const canManageTerms = (r: DeliverectAccessResult | null | undefined): boolean =>
  deliverectGrants(r).canManageTerms

/**
 * Adding a delivery platform (`POST Platforms`, its own grant). Not one of the menu's four flags:
 * it only shows the page's "Add platform" button. 🚩 Fails closed exactly as the four do — only an
 * explicit `true` grants; the server re-checks the grant on the door.
 */
export const canAddPlatform = (r: DeliverectAccessResult | null | undefined): boolean =>
  typeof r === 'object' && r !== null && (r as { canAddPlatform?: unknown }).canAddPlatform === true
