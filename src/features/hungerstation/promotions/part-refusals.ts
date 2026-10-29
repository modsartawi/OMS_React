import type {
  HungerStationPromotionDetail,
  HungerStationPromotionRefusals,
  HungerStationPromotionSend,
  HungerStationPromotionSkuRef,
} from '@/core/models/hungerstation'

// What HungerStation refused in a part's latest answer (ticket 669; BackOffice spec 3201, 3214):
// its `invalid_vendors`, `missing_skus` and `invalid_discounted_skus`, regrouped PER STORE so a
// person reads "what did not take at this store"; and when a part reads Sending, or has had no
// answer for 24 hours. Pure: no React, no `t`.

/** One store's refusals in one part. `key` is the store code, `vendor:<id>` for a vendor id that
 *  is none of our stores, or `unresolved` when HungerStation named no vendor at all. */
export interface StoreRefusals {
  key: string
  storeCode: string | null
  vendorId: string | null
  /** HungerStation called the store (its vendor id) invalid. */
  invalidVendor: boolean
  /** Materials HungerStation could not find at this store. */
  missing: HungerStationPromotionSkuRef[]
  /** Materials whose promo price HungerStation found above its list price at this store. */
  overList: HungerStationPromotionSkuRef[]
}

export interface RefusalsByStore {
  stores: StoreRefusals[]
  counts: { invalidVendors: number; missingSkus: number; invalidDiscountedSkus: number; stores: number }
}

export const UNRESOLVED = 'unresolved'
const storeKey = (storeCode: string | null, vendorId: string | null) => storeCode ?? (vendorId ? `vendor:${vendorId}` : UNRESOLVED)

/**
 * A part's refusals per store, ordered by store code (an unresolved vendor after every store), and
 * counted. `null` — no section — when HungerStation refused nothing, or has given no answer yet.
 */
export function refusalsByStore(refusals: HungerStationPromotionRefusals | null): RefusalsByStore | null {
  if (!refusals) return null
  const by = new Map<string, StoreRefusals>()
  const at = (storeCode: string | null, vendorId: string | null) => {
    const key = storeKey(storeCode, vendorId)
    let s = by.get(key)
    if (!s) by.set(key, (s = { key, storeCode, vendorId, invalidVendor: false, missing: [], overList: [] }))
    return s
  }
  for (const v of refusals.invalidVendors ?? []) at(v.storeCode, v.vendorId).invalidVendor = true
  for (const s of refusals.missingSkus ?? []) if (s.items?.length) at(s.storeCode, s.vendorId).missing.push(...s.items)
  for (const s of refusals.invalidDiscountedSkus ?? []) if (s.items?.length) at(s.storeCode, s.vendorId).overList.push(...s.items)
  if (by.size === 0) return null
  const stores = [...by.values()].sort((a, b) =>
    a.storeCode === null || b.storeCode === null
      ? Number(a.storeCode === null) - Number(b.storeCode === null) || (a.vendorId ?? '￿').localeCompare(b.vendorId ?? '￿')
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
    const head = [s.storeCode ?? '', s.vendorId ?? '']
    if (list === 'invalidVendors') {
      if (s.invalidVendor) lines.push(head)
    } else {
      for (const k of list === 'missingSkus' ? s.missing : s.overList) lines.push([...head, k.materialNumber ?? '', k.sku])
    }
  }
  return lines.map((l) => l.join('\t')).join('\n')
}

/** A part is **Sending** exactly when it reads so (contract 3214): its latest job is still open —
 *  an upsert's or a switch-off's. A part unanswered for 24 hours reads Failed instead. */
export const partSending = (part: { status: string | null }): boolean => part.status === 'sending'

type Sends = Pick<HungerStationPromotionDetail, 'parts' | 'sends'>

/** A part's latest send (`sends` are oldest first). */
export function latestSend(d: Pick<HungerStationPromotionDetail, 'sends'>, partId: string): HungerStationPromotionSend | null {
  const sends = d.sends ?? []
  for (let i = sends.length - 1; i >= 0; i--) if (sends[i].partId === partId) return sends[i]
  return null
}

/** The 24-hour part (contract 3214): it reads Failed while its latest job is still QUEUED — the
 *  poller stopped asking. A manual Refresh still reads it; a Resend sends it again. */
export function partUnanswered(d: Sends, partId: string): boolean {
  const part = (d.parts ?? []).find((p) => p.partId === partId)
  return part?.status === 'failed' && latestSend(d, partId)?.jobStatus === 'QUEUED'
}

/** That 24-hour part's latest send — the one to read "No answer from HungerStation". */
export const sendUnanswered = (d: Sends, s: HungerStationPromotionSend): boolean => latestSend(d, s.partId) === s && partUnanswered(d, s.partId)

/** How often the open detail re-reads itself: the server polls HungerStation every minute. */
export const PROMOTION_POLL_MS = 15000

/** TanStack's `refetchInterval` for the detail: every 15 s while the promotion — or any part —
 *  reads Sending, else never. */
export function promotionPollInterval(detail: Pick<HungerStationPromotionDetail, 'status' | 'parts'> | undefined): number | false {
  if (!detail) return false
  return detail.status === 'sending' || (detail.parts ?? []).some(partSending) ? PROMOTION_POLL_MS : false
}
