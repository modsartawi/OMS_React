/**
 * Pure helpers for the Screen 2 Change Store sub-flow.
 */
import type { SdDistrictModel } from '@/core/models/lookups'

/**
 * The Change Store mode, decided by the document's delivery type:
 *
 * - `pick-in-store` — `deliveryType === 'P'`: the operator picks a store row.
 * - `delivery` — any other type: the operator searches districts and the
 *   fulfilling store is *derived* from the chosen district.
 */
export type ChangeStoreMode = 'pick-in-store' | 'delivery'

/** `DocumentDeliveryType` code for PickInStore. */
const PICK_IN_STORE_DELIVERY_TYPE = 'P'

/**
 * Decide the Change Store mode from a document's `deliveryType`.
 *
 * ⚠ This compares against the CODE `'P'`, which is what the document endpoint
 * returns. The Screen 1 LIST endpoint resolves the same field to a description
 * (`'PickInStore'`) — feeding a list row in here would silently pick delivery
 * mode for every document.
 */
export function changeStoreMode(deliveryType: string | null | undefined): ChangeStoreMode {
  return (deliveryType ?? '').trim().toUpperCase() === PICK_IN_STORE_DELIVERY_TYPE
    ? 'pick-in-store'
    : 'delivery'
}

/**
 * Derive the fulfilling store from a chosen district: `tempStoreCode` (the
 * operational failover override) wins when non-empty, else `storeCode`. Returns
 * `''` when the district yields no usable store — the caller must then BLOCK the
 * action rather than post an empty store.
 *
 * The CC2 insurance refinement (preferring `insuranceStoreCode`) is a
 * creation-time order-kind concept; a loaded OMS document carries no reliable
 * insurance-routing signal, and the WPF Change Store itself derived only
 * `tempStoreCode || storeCode`. So this mirrors that faithfully (D-22).
 */
export function deriveStoreCode(district: SdDistrictModel | null | undefined): string {
  if (!district) return ''
  const temp = (district.tempStoreCode ?? '').trim()
  return temp || (district.storeCode ?? '').trim()
}

/**
 * A human-readable city label for a district — English name, falling back to
 * Arabic. This is what `actionData2` carries for a delivery-mode change.
 */
export function districtCityName(district: SdDistrictModel | null | undefined): string {
  if (!district) return ''
  return (district.cityNameEn ?? '').trim() || (district.cityNameAr ?? '').trim()
}
