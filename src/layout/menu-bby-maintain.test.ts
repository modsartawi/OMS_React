/**
 * The Bonus Buy Maintenance nav leaf (ticket 416, BackOffice spec 2374 story 85): hidden
 * from the navigation of a session without the `BbyMaintain` grant. The leaf is read out of
 * the **real** `MENU`, never re-declared.
 */
import { describe, expect, it } from 'vitest'
import {
  BBY_MAINTAIN_ACCESS_KEY,
  bbyMaintainAccessQuery,
} from '@/features/pricing/bonus-buy-maintenance/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const pricing = MENU.find((g) => g.labelKey === 'simulation:menu.pricing')!
const leaf = (pricing.items ?? []).find(
  (i) => i.labelKey === 'bonus-buy-maintenance:menu.bonusBuyMaintenance',
)!
/** The leaf alone, under its group, so the other Pricing probes do not take part. */
const group: ShellMenuItem = { ...pricing, items: [leaf] }
const labels = (items: ShellMenuItem[]): string[] =>
  items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])
const answered = (data: unknown): ProbeState[] => [{ isPending: false, isSuccess: true, data }]

describe('nav entry hidden when screenAllowed is false', () => {
  it('sits under Pricing, gated on the key the screen gate reads', () => {
    expect(leaf.routerLink).toBe('/pricing/bonus-buy-maintenance')
    expect(leaf.access!.key).toBe(BBY_MAINTAIN_ACCESS_KEY)
    expect(bbyMaintainAccessQuery().queryKey).toBe(BBY_MAINTAIN_ACCESS_KEY)
    expect(bbyMaintainAccessQuery().retry).toBe(false)
  })

  it('granted → shown', () => {
    expect(labels(resolveMenu([group], answered({ screenAllowed: true })).items)).toContain(
      'bonus-buy-maintenance:menu.bonusBuyMaintenance',
    )
  })

  it('screenAllowed false → hidden', () => {
    expect(resolveMenu([group], answered({ screenAllowed: false })).items).toEqual([])
  })

  it('🚩 fails closed: errored, pending or malformed → hidden', () => {
    for (const states of [
      [{ isPending: false, isSuccess: false, data: undefined }],
      [{ isPending: true, isSuccess: false, data: undefined }],
      answered({}),
      answered({ screenAllowed: 'true' }),
      answered(null),
    ] as ProbeState[][]) {
      expect(resolveMenu([group], states).items).toEqual([])
    }
  })
})
