import { useQuery } from '@tanstack/react-query'
import type { OmsAccessResult } from '@/core/models/oms-access'
import { omsAccessQuery } from './api'

// The insurance-view grant (BackOffice spec 3389, door 3390; client tickets 786–789). In `core/`
// because three features-to-be read it — the Order / ERX list (786: patient / member ID and their
// export), Document Details' Insurance section (787/788) and the delivery money strip's link (789) —
// and a feature may never import another.
//
// Confirmed against the built server (BackOffice pricing2, 3389 hotfix): one more flag of the OMS
// probe both OMS pages and the menu already share (`GET SdDocumentWeb/Access`, one cache entry),
// `canViewInsurance`, read from the same gate (`IOmsInsuranceViewGate`,
// `BackOfficeScreen[OmsInsuranceView,03]`) the insurance door's filter reads.
//
// 🚩 Fails closed, deliberately: it guards health data. Absent (today's SIS.Api), pending, failed or
// malformed all read as NOT granted, so the section and the ID columns stay away until the server
// learns the flag. Drives stub it by answering `canViewInsurance: true` on `SdDocumentWeb/Access`.
// It only hides: the door's grant filter is the boundary (3389 user story 71). A 403 from an
// insurance door drops it for the page life: `revokeOnForbidden(queryClient, err, 'canViewInsurance')`.

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
