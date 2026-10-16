import type { OmsAccessResult } from '@/core/models/oms-access'

// The OMS probe's screen flags (spec 430 D2, ticket 431). Pure: no React, no `t`.
//
// The five OMS screens of spec 430 each read their own flag off the ONE `OMS_ACCESS_KEY` entry
// (`@/core/oms/api`), so the OMS group still costs one call. This module is the one reading of
// those flags: the menu leaf and the page gate take the same predicate, so they cannot disagree.

/**
 * The nine flags of D2, in the order the spec lists them, then the two Pick support flags
 * (BackOffice brief 2691, shipped in BackOffice 2731), then Document Details' two write grants
 * (BackOffice 2763, ticket 521) — all read the same way, absent = denied.
 */
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
  'canOpenPickSupport',
  'canFixPickSupport',
  'canChangeDetail',
  'canCreateReturn',
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

/** Document payments (ticket 433): the leaf's and the page gate's one predicate. */
export const canOpenDocumentPayments = (r: OmsAccessResult | null | undefined): boolean =>
  omsGrants(r).canOpenDocumentPayments

/** Failed donor transfers (ticket 434): the leaf's and the page gate's one predicate. */
export const canOpenFailedTransfers = (r: OmsAccessResult | null | undefined): boolean =>
  omsGrants(r).canOpenFailedTransfers

/** Cities & districts (ticket 436): the leaf's and the page gate's one predicate. */
export const canOpenGeography = (r: OmsAccessResult | null | undefined): boolean =>
  omsGrants(r).canOpenGeography

/** Document source users (ticket 438): the leaf's and the page gate's one predicate. */
export const canOpenDocumentSourceUsers = (r: OmsAccessResult | null | undefined): boolean =>
  omsGrants(r).canOpenDocumentSourceUsers

/**
 * Delivery statistics (ticket 484, BackOffice 2641): the leaf's and the page gate's one predicate.
 * Not a spec 430 flag — the door checks the OMS LIST grant (`BackOfficeScreen[DocumentList,03]`),
 * so this reads `canOpenList`. If the owner swaps in a dedicated statistics grant, only this changes.
 */
export const canOpenDeliveryStatistics = (r: OmsAccessResult | null | undefined): boolean => r?.canOpenList === true

/** Pick support (ticket 496, brief 2691) — `PickSupport,03`: the leaf's and the page gate's one predicate. */
export const canOpenPickSupport = (r: OmsAccessResult | null | undefined): boolean => omsGrants(r).canOpenPickSupport

/** Pick support's fix (ticket 497 draws the button) — `PickSupport,06`. Hide the button without it. */
export const canFixPickSupport = (r: OmsAccessResult | null | undefined): boolean => omsGrants(r).canFixPickSupport

/**
 * Document Details' change doors (ticket 521, BackOffice 2763) — `DocumentDetails,02`. On top of
 * `canOpenDetail`, never instead of it: the screen still opens on `canOpenDetail` alone.
 */
export const canChangeDetail = (r: OmsAccessResult | null | undefined): boolean => omsGrants(r).canChangeDetail

/** Create return (ticket 521, BackOffice 2763) — `OmsCreateReturn,01`. Change does not imply it. */
export const canCreateReturn = (r: OmsAccessResult | null | undefined): boolean => omsGrants(r).canCreateReturn
