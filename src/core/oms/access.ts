import type { OmsAccessResult } from '@/core/models/oms-access'

// The OMS probe's screen flags (spec 430 D2, ticket 431). Pure: no React, no `t`.
//
// The five OMS screens of spec 430 each read their own flag off the ONE `OMS_ACCESS_KEY` entry
// (`@/core/oms/api`), so the OMS group still costs one call. This module is the one reading of
// those flags: the menu leaf and the page gate take the same predicate, so they cannot disagree.

/** The nine flags of D2, in the order the spec lists them. */
export const OMS_SCREEN_FLAGS = [
  'canOpenDonorRequests',
  'canOpenDocumentPayments',
  'canOpenFailedTransfers',
  'canReRunFailedTransfer',
  'canOpenGeography',
  'canImportCities',
  'canImportDistricts',
  'canOpenDocumentSourceUsers',
  'canImportDocumentSourceUsers',
] as const

export type OmsScreenFlag = (typeof OMS_SCREEN_FLAGS)[number]
export type OmsGrants = Record<OmsScreenFlag, boolean>

/**
 * Every D2 flag as a plain boolean. 🚩 Only an explicit `true` grants: an absent flag (a server
 * that has not learned it yet), a missing answer or a malformed value all read as `false`, so the
 * probe keeps failing closed.
 */
export function omsGrants(r: Partial<OmsAccessResult> | null | undefined): OmsGrants {
  return Object.fromEntries(OMS_SCREEN_FLAGS.map((flag) => [flag, r?.[flag] === true])) as OmsGrants
}

/** Donor requests (ticket 431): the leaf's and the page gate's one predicate. */
export const canOpenDonorRequests = (r: OmsAccessResult | null | undefined): boolean =>
  omsGrants(r).canOpenDonorRequests
