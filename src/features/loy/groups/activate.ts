/**
 * Deactivate / reactivate a group — the pure half (oms ticket 631, BackOffice spec 3173; door
 * `POST LoyGroupWeb/Groups/SetActive`, 3174). No React, no `t`: the confirm answers a `loy-groups` key
 * and the lines, the caller translates and renders them (promo number `Ltr`, description `<bdi>`).
 *
 * 🚩 There is no delete door and no delete control: deactivating is the only way to stop a group.
 */
import { liveBonusBuysOf } from '@/core/loy-groups/api'
import type { LoyGroup, LoyGroupBonusBuy, LoyGroupSetActiveRequest } from '@/core/models/loy-groups'

export interface DeactivateConfirm {
  /** The sentence above the list — or, with no lines, the one that says no live offer stops. */
  sentence: 'activate.confirm.stops' | 'activate.confirm.stopsNone'
  /** Every live bonus-buy naming the group, in the order the door sent them. */
  lines: LoyGroupBonusBuy[]
}

/** What the deactivate confirm says about the group's live bonus-buys (an absent field reads as none). */
export function deactivateConfirm(group: Pick<LoyGroup, 'liveBonusBuys'>): DeactivateConfirm {
  const lines = liveBonusBuysOf(group)
  return { sentence: lines.length > 0 ? 'activate.confirm.stops' : 'activate.confirm.stopsNone', lines }
}

/** The `SetActive` body — `{ groupId, isActive }` and nothing else. */
export function setActiveRequest(groupId: string, isActive: boolean): LoyGroupSetActiveRequest {
  return { groupId, isActive }
}
