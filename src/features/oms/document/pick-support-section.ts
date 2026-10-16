/**
 * Document Details' **Pick support** section (ticket 499, BackOffice brief 2691): the pure rules
 * the facts column reads. The brief's "tab" is a folded section since spec 380 removed the tabs.
 *
 * Pure: no React, no network, no i18n. The diagnosis, its door and the panel are the shared ones
 * in `@/core/pick-support`; the grant is the one OMS probe's (`@/core/oms/access`).
 */
import type { OmsAccessResult } from '@/core/models/oms-access'
import type { PickSupportDiagnosis } from '@/core/models/pick-support'
import { canOpenPickSupport } from '@/core/oms/access'
import type { OpenedAs } from './actions'

/**
 * Is the section drawn? Only on a page opened as a **delivery** (`oms/delivery/:deliveryNo`) and
 * only with `canOpenPickSupport`. It fails closed: a probe still pending, failed, or without the
 * flag hides it. The fix grant is the panel's own business, not the section's.
 */
export function pickSupportSectionGate(openedAs: OpenedAs, access: OmsAccessResult | null | undefined): boolean {
  return openedAs === 'delivery' && canOpenPickSupport(access)
}

/**
 * Does the heading carry the stuck marker? Only once a diagnosis has been read and the server's
 * verdict is `STUCK`. HEALTHY, UNKNOWN, an unlisted verdict and "not read yet" carry none.
 */
export function headingShowsStuck(diagnosis: Pick<PickSupportDiagnosis, 'verdict'> | null | undefined): boolean {
  return diagnosis?.verdict === 'STUCK'
}
