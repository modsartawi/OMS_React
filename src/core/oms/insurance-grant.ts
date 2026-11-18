import { usePermissions, type Permissions } from '@/core/permissions'

// The insurance-view grant (BackOffice spec 3389, door 3390; client tickets 786–789), read off the one permissions
// answer (oms 914): `OmsInsuranceView:03`. In `core/` because three features read it — the Order / ERX list (patient /
// member ID and their export), Document Details' Insurance section and the delivery money strip's link — and a feature
// may never import another.
//
// 🚩 Fails closed, deliberately: it guards health data. Pending, failed or absent all read as NOT granted. It only
// hides: the door's grant filter is the boundary. A 403 from an insurance door invalidates the one answer.

/** Whether the session may see an insurance order's health data. */
export const canViewInsurance = (p: Permissions): boolean => p.has('OmsInsuranceView:03')

/** The grant off the one answer. `false` while it is pending or failed. */
export function useCanViewInsurance(): boolean {
  return canViewInsurance(usePermissions())
}
