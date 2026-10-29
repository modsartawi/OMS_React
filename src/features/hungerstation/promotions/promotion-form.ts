import {
  HUNGERSTATION_PROMOTION_MAX_SKUS,
  type HungerStationDiscountSubtype,
  type HungerStationPromotionDetail,
  type HungerStationPromotionItemInput,
  type HungerStationPromotionReason,
  type HungerStationPromotionSaveBody,
  type HungerStationPromotionType,
} from '@/core/models/hungerstation'
import { defaultWindow, windowFromLocal, windowProblem, windowToLocal, type LocalWindow } from './local-window'

/**
 * The promotion editor's form (ticket 666; the same-item bundle 668) and the save body it becomes — pure. Number boxes are
 * held as typed text and read on save; a blank one is `null`.
 */

export const HS_REASONS: readonly HungerStationPromotionReason[] = ['COMPETITIVENESS', 'OVERSTOCK', 'DELISTING', 'EXPIRING_SOON', 'NMR', 'TRADING']
export const DISCOUNT_SUBTYPES: readonly HungerStationDiscountSubtype[] = ['PERCENTAGE', 'ABSOLUTE', 'FINAL_PRICE']

export interface PromotionForm {
  /** 668: a strikethrough or a same-item bundle. */
  type: HungerStationPromotionType
  chainKey: string
  name: string
  displayNameEn: string
  displayNameAr: string
  hsReason: HungerStationPromotionReason
  orderLimit: string
  globalLimit: string
  window: LocalWindow
  defaultSubtype: HungerStationDiscountSubtype
  defaultValue: string
  /** 668: a bundle's default buy / get, as typed; blank for none. Not read on a strikethrough. */
  defaultBuy: string
  defaultGet: string
  /** Every store of the chain (frozen when sent), or the codes ticked. */
  stores: 'all' | string[]
  items: HungerStationPromotionItemInput[]
}

export function emptyForm(now: Date): PromotionForm {
  return {
    type: 'STRIKETHROUGH',
    chainKey: '',
    name: '',
    displayNameEn: '',
    displayNameAr: '',
    hsReason: 'COMPETITIVENESS',
    orderLimit: '',
    globalLimit: '',
    window: defaultWindow(now),
    defaultSubtype: 'PERCENTAGE',
    defaultValue: '',
    defaultBuy: '',
    defaultGet: '',
    stores: 'all',
    items: [],
  }
}

/** A saved draft back into the form: its active items, its stores as saved. */
export function formFromDetail(d: HungerStationPromotionDetail): PromotionForm {
  const text = (n: number | null) => (n === null ? '' : String(n))
  return {
    type: d.type,
    chainKey: d.chainKey,
    name: d.name,
    displayNameEn: d.displayNameEn,
    displayNameAr: d.displayNameAr,
    hsReason: d.hsReason,
    orderLimit: text(d.orderLimit),
    globalLimit: text(d.globalLimit),
    window: windowFromLocal(d.startAt, d.endAt),
    defaultSubtype: d.defaultSubtype,
    defaultValue: text(d.defaultValue),
    defaultBuy: text(d.defaultBuyQuantity ?? null),
    defaultGet: text(d.defaultGetQuantity ?? null),
    stores: d.allStores ? 'all' : (d.stores ?? []).map((s) => s.storeCode),
    items: (d.items ?? [])
      .filter((i) => i.active)
      .map((i) => ({ materialNumber: i.materialNumber, subtype: i.subtype, value: i.value, maxQuantity: i.maxQuantity, buyQuantity: i.buyQuantity, getQuantity: i.getQuantity })),
  }
}

/** Untick a store, or tick it back; every store ticked is "all" again. */
export function toggleStore(stores: 'all' | string[], code: string, choices: readonly string[]): 'all' | string[] {
  const ticked = stores === 'all' ? [...choices] : stores
  const next = ticked.includes(code) ? ticked.filter((c) => c !== code) : [...ticked, code]
  return choices.length > 0 && choices.every((c) => next.includes(c)) ? 'all' : choices.filter((c) => next.includes(c))
}

const limitOf = (text: string): number | null | undefined => {
  const t = text.trim()
  if (t === '') return null
  return /^\d+$/.test(t) && Number(t) >= 1 ? Number(t) : undefined
}
const valueOf = (text: string): number | null | undefined => {
  const t = text.trim()
  if (t === '') return null
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : undefined
}

export type FormField = 'chainKey' | 'name' | 'displayNameEn' | 'displayNameAr' | 'window' | 'orderLimit' | 'globalLimit' | 'defaultValue' | 'defaultBuy' | 'defaultGet' | 'stores' | 'items'

/** What keeps the form from saving, in form order. The value checks proper (ranges, decimals, the
 *  name in use) are the server's. */
export function formProblems(f: PromotionForm, now: Date): FormField[] {
  const out: FormField[] = []
  if (!f.chainKey.trim()) out.push('chainKey')
  if (!f.name.trim()) out.push('name')
  if (!f.displayNameEn.trim()) out.push('displayNameEn')
  if (!f.displayNameAr.trim()) out.push('displayNameAr')
  if (windowProblem(f.window, now)) out.push('window')
  if (limitOf(f.orderLimit) === undefined) out.push('orderLimit')
  if (limitOf(f.globalLimit) === undefined) out.push('globalLimit')
  if (valueOf(f.defaultValue) === undefined) out.push('defaultValue')
  if (f.type === 'SAME_ITEM_BUNDLE' && limitOf(f.defaultBuy) === undefined) out.push('defaultBuy')
  if (f.type === 'SAME_ITEM_BUNDLE' && limitOf(f.defaultGet) === undefined) out.push('defaultGet')
  if (f.stores !== 'all' && f.stores.length === 0) out.push('stores')
  if (f.items.length > HUNGERSTATION_PROMOTION_MAX_SKUS) out.push('items')
  return out
}

/** The save body (`POST` / `PUT`): call only on a form with no problems. */
export function saveBody(f: PromotionForm, reason: string): HungerStationPromotionSaveBody {
  const bundle = f.type === 'SAME_ITEM_BUNDLE'
  return {
    chainKey: f.chainKey.trim(),
    name: f.name.trim(),
    displayNameEn: f.displayNameEn.trim(),
    displayNameAr: f.displayNameAr.trim(),
    type: f.type,
    hsReason: f.hsReason,
    ...windowToLocal(f.window),
    orderLimit: limitOf(f.orderLimit) ?? null,
    globalLimit: limitOf(f.globalLimit) ?? null,
    defaultSubtype: f.defaultSubtype,
    defaultValue: valueOf(f.defaultValue) ?? null,
    defaultBuyQuantity: bundle ? (limitOf(f.defaultBuy) ?? null) : null,
    defaultGetQuantity: bundle ? (limitOf(f.defaultGet) ?? null) : null,
    allStores: f.stores === 'all',
    storeCodes: f.stores === 'all' ? [] : f.stores,
    // A strikethrough row carries no buy / get, whatever it was pasted as before a type change.
    items: bundle ? f.items : f.items.map((i) => ({ ...i, buyQuantity: null, getQuantity: null })),
    reason: reason.trim(),
  }
}
