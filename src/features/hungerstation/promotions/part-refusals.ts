import type {
  HungerStationPromotionDetail,
  HungerStationPromotionPart,
  HungerStationPromotionRefusals,
  HungerStationPromotionRefusedSku,
} from '@/core/models/hungerstation'

// What HungerStation refused in a part's latest final answer (ticket 669; BackOffice spec 3201,
// 3214): its `invalid_vendors`, `missing_skus` and `invalid_discounted_skus`, regrouped PER STORE so
// a person reads "what did not take at this store", plus when a part reads as Sending. Pure: no
// React, no `t`.

/** One store's refusals in one part. `key` is the store code, or `vendor:<id>` for a vendor id
 *  that no longer resolves to one of our stores. */
export interface StoreRefusals {
  key: string
  storeCode: string | null
  vendorId: string
  /** HungerStation called the store (its vendor id) invalid. */
  invalidVendor: boolean
  /** Materials HungerStation could not find at this store. */
  missing: HungerStationPromotionRefusedSku[]
  /** Materials whose promo price HungerStation found above its list price at this store. */
  overList: HungerStationPromotionRefusedSku[]
}

export interface RefusalsByStore {
  stores: StoreRefusals[]
  counts: { invalidVendors: number; missingSkus: number; invalidDiscountedSkus: number; stores: number }
}

const storeKey = (storeCode: string | null, vendorId: string) => storeCode ?? `vendor:${vendorId}`

/**
 * A part's refusals per store, ordered by store code (an unresolved vendor after every store), and
 * counted. `null` — no section — when HungerStation refused nothing, or has given no final answer.
 */
export function refusalsByStore(refusals: HungerStationPromotionRefusals | null): RefusalsByStore | null {
  if (!refusals) return null
  const by = new Map<string, StoreRefusals>()
  const at = (storeCode: string | null, vendorId: string) => {
    const key = storeKey(storeCode, vendorId)
    let s = by.get(key)
    if (!s) by.set(key, (s = { key, storeCode, vendorId, invalidVendor: false, missing: [], overList: [] }))
    return s
  }
  for (const v of refusals.invalidVendors) at(v.storeCode, v.vendorId).invalidVendor = true
  for (const s of refusals.missingSkus) if (s.skus.length) at(s.storeCode, s.vendorId).missing.push(...s.skus)
  for (const s of refusals.invalidDiscountedSkus) if (s.skus.length) at(s.storeCode, s.vendorId).overList.push(...s.skus)
  if (by.size === 0) return null
  const stores = [...by.values()].sort((a, b) =>
    a.storeCode === null || b.storeCode === null
      ? Number(a.storeCode === null) - Number(b.storeCode === null) || a.vendorId.localeCompare(b.vendorId)
      : a.storeCode.localeCompare(b.storeCode),
  )
  return {
    stores,
    counts: {
      invalidVendors: stores.filter((s) => s.invalidVendor).length,
      missingSkus: stores.reduce((n, s) => n + s.missing.length, 0),
      invalidDiscountedSkus: stores.reduce((n, s) => n + s.overList.length, 0),
      stores: stores.length,
    },
  }
}

/** The stores shown under the store filter: every one (`null`), or the chosen one. */
export function refusalsForStore(grouped: RefusalsByStore, key: string | null): StoreRefusals[] {
  return key === null ? grouped.stores : grouped.stores.filter((s) => s.key === key)
}

export type RefusalList = 'invalidVendors' | 'missingSkus' | 'invalidDiscountedSkus'

/** One list as the clipboard takes it, one tab-separated line per entry: store code, vendor id —
 *  and for a SKU list our material number and HungerStation's SKU. A value we cannot name is blank.
 *  No header and no isolates: it pastes into Excel as data. */
export function refusalsCopyText(stores: StoreRefusals[], list: RefusalList): string {
  const lines: string[][] = []
  for (const s of stores) {
    const head = [s.storeCode ?? '', s.vendorId]
    if (list === 'invalidVendors') {
      if (s.invalidVendor) lines.push(head)
    } else {
      for (const k of list === 'missingSkus' ? s.missing : s.overList) lines.push([...head, k.materialNumber ?? '', k.sku])
    }
  }
  return lines.map((l) => l.join('\t')).join('\n')
}

/** A part is **Sending** while its latest job is QUEUED — until 24 hours pass, when it is
 *  `unanswered`: the server stops polling it and leaves it for a manual Refresh. */
export function partSending(part: Pick<HungerStationPromotionPart, 'latestJobStatus' | 'unanswered'>): boolean {
  return part.latestJobStatus === 'QUEUED' && !part.unanswered
}

/** How often the open detail re-reads itself: the server polls HungerStation every minute. */
export const PROMOTION_POLL_MS = 15000

/** TanStack's `refetchInterval` for the detail: every 15 s while any part is Sending, else never. */
export function promotionPollInterval(detail: Pick<HungerStationPromotionDetail, 'parts'> | undefined): number | false {
  return (detail?.parts ?? []).some(partSending) ? PROMOTION_POLL_MS : false
}
