/**
 * The Mini POS items screen's server calls (oms 927, BackOffice 4074): the A-level allow-list
 * (`MiniPosAdmin/AllowedCategories`) and the refusal list (`MiniPosAdmin/RefusedItems`). Lists behind `MiniPosAdmin:03`,
 * adds and removals behind `MiniPosAdmin:06`.
 *
 * Through `@/core/api` (`api-envelope`). An unknown category or item is refused `MINIPOS_CATEGORY_UNKNOWN` /
 * `MINIPOS_ITEM_UNKNOWN`; a removal of a row that is not there succeeds.
 */
import { api } from '@/core/api'
import type { MiniPosAllowedCategory, MiniPosRefusedItem } from '@/core/models/mini-pos'

export const miniPosItemsApi = {
  /** `GET MiniPosAdmin/AllowedCategories` → the allow-list, by code. */
  async categories(): Promise<MiniPosAllowedCategory[]> {
    return (await api.get<MiniPosAllowedCategory[] | null>('MiniPosAdmin/AllowedCategories')) ?? []
  },

  /** `POST MiniPosAdmin/AllowedCategories` `{ aCode }` → the row. */
  addCategory(aCode: string): Promise<MiniPosAllowedCategory> {
    return api.post<MiniPosAllowedCategory>('MiniPosAdmin/AllowedCategories', { aCode })
  },

  /** `POST MiniPosAdmin/AllowedCategories/{aCode}/Remove`. */
  removeCategory(aCode: string): Promise<boolean> {
    return api.post<boolean>(`MiniPosAdmin/AllowedCategories/${encodeURIComponent(aCode)}/Remove`, {})
  },

  /** `GET MiniPosAdmin/RefusedItems` → the refusal list, by item. */
  async refusedItems(): Promise<MiniPosRefusedItem[]> {
    return (await api.get<MiniPosRefusedItem[] | null>('MiniPosAdmin/RefusedItems')) ?? []
  },

  /** `POST MiniPosAdmin/RefusedItems` `{ itemNumber, reasonNote }` → the row (an item already listed gets the new reason). */
  addRefusedItem(itemNumber: string, reasonNote: string): Promise<MiniPosRefusedItem> {
    return api.post<MiniPosRefusedItem>('MiniPosAdmin/RefusedItems', { itemNumber, reasonNote })
  },

  /** `POST MiniPosAdmin/RefusedItems/{itemNumber}/Remove`. */
  removeRefusedItem(itemNumber: string): Promise<boolean> {
    return api.post<boolean>(`MiniPosAdmin/RefusedItems/${encodeURIComponent(itemNumber)}/Remove`, {})
  },
}
