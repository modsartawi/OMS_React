import { useQuery, type QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/core/api'
import type { OmsAccessResult } from '@/core/models/oms-access'
import { OMS_ACCESS_KEY, omsAccessQuery } from './api'

// The insurance-view grant (BackOffice spec 3389, door 3390; client tickets 786–789). In `core/`
// because three features-to-be read it — the Order / ERX list (786: patient / member ID and their
// export), Document Details' Insurance section (787/788) and the delivery money strip's link (789) —
// and a feature may never import another.
//
// GUESS (the live-door ticket reconciles): 3390 names "a new insurance-view grant" but no code and no
// probe. It is read as one more optional flag of the OMS probe both OMS pages and the menu already
// share (`GET SdDocumentWeb/Access`, one cache entry) — the guard grants' precedent (ticket 616,
// `@/core/insurance-rules/order-guards`). Flag `canViewInsurance`, grant code guessed as
// `BackOfficeScreen[OmsInsuranceView,03]`.
//
// 🚩 Fails closed, deliberately: it guards health data. Absent (today's SIS.Api), pending, failed or
// malformed all read as NOT granted, so the section and the ID columns stay away until the server
// learns the flag. Drives stub it by answering `canViewInsurance: true` on `SdDocumentWeb/Access`.
// It only hides: the door's grant filter is the boundary (3389 user story 71).

/** Whether the session may see an insurance order's health data. Only an explicit `true` grants. */
export const canViewInsurance = (r: Partial<OmsAccessResult> | null | undefined): boolean =>
  r?.canViewInsurance === true

/**
 * The grant, read off the shared OMS probe entry (same key and options as the menu and both OMS
 * pages, so it costs no extra call). `false` while the probe is pending or failed.
 */
export function useCanViewInsurance(): boolean {
  const access = useQuery(omsAccessQuery())
  return canViewInsurance(access.data)
}

/**
 * Drop the grant for the rest of the page life after an insurance door answers 403 — the server's
 * answer outranks the probe's (the `revokeOnForbidden` reasoning; `staleTime: Infinity` means
 * nothing else would re-ask). Anything but a 403 leaves it alone; only this flag is cleared.
 */
export function revokeInsuranceViewOnForbidden(queryClient: QueryClient, err: unknown): void {
  if (!(err instanceof ApiError) || err.statusCode !== 403) return
  queryClient.setQueryData<OmsAccessResult>(OMS_ACCESS_KEY, (prev) => (prev ? { ...prev, canViewInsurance: false } : prev))
}
