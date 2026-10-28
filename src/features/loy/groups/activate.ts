/**
 * Deactivate / reactivate a group — the pure half (oms ticket 631, BackOffice spec 3173; door
 * `POST LoyGroupWeb/Groups/SetActive`, 3174). No React, no `t`: the confirm answers a `loy-groups` key
 * and the lines, the caller translates and renders them (promo number `Ltr`, description `<bdi>`).
 *
 * 🚩 There is no delete door and no delete control: deactivating is the only way to stop a group.
 */
import type { LoyGroup, LoyGroupBonusBuy, LoyGroupSetActiveRequest } from '@/core/models/loy-groups'

export interface DeactivateConfirm {
  /**
   * The sentence above the list — with no lines, the one that says no live offer stops; and when no
   * door sent `liveBonusBuys` at all, the one that says the offers it stops are not known.
   */
  sentence: 'activate.confirm.stops' | 'activate.confirm.stopsNone' | 'activate.confirm.stopsUnknown'
  /** Every live bonus-buy naming the group, in the order the door sent them. */
  lines: LoyGroupBonusBuy[]
}

type BonusBuysOf = Partial<Pick<LoyGroup, 'liveBonusBuys'>>

/**
 * What the deactivate confirm says about the group's live bonus-buys. The detail door's field first;
 * when it omits the field (an older door — absent, not `[]`), the groups-list entry for the same group.
 * 🚩 Never "stops no live offer" without a door having said so: neither field → `stopsUnknown`.
 */
export function deactivateConfirm(detail: BonusBuysOf, listEntry?: BonusBuysOf): DeactivateConfirm {
  const known = [detail.liveBonusBuys, listEntry?.liveBonusBuys].find(Array.isArray)
  if (!known) return { sentence: 'activate.confirm.stopsUnknown', lines: [] }
  return { sentence: known.length > 0 ? 'activate.confirm.stops' : 'activate.confirm.stopsNone', lines: known }
}

/** The `SetActive` body — `{ groupId, isActive }` and nothing else. */
export function setActiveRequest(groupId: string, isActive: boolean): LoyGroupSetActiveRequest {
  return { groupId, isActive }
}
