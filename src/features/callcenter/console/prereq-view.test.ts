import { describe, expect, it } from 'vitest'

import i18n from '@/core/i18n'
import { REWARD_RESOLUTION } from './__fixtures__/payloads'
import type { GuidancePhrase } from './guidance-view'
import { prereqRows, rewardResolutionView } from './prereq-view'

/**
 * Ticket 415 (spec 412 W5) — one reward arm's products, resolved on demand.
 *
 * The input is the provisional `ResolveReward` answer for staging's bonus buy
 * 803, arm 2 (`10 off 500062`). BO-2 is unfiled, so it is a stub of exactly the
 * W5 shape. What is asserted is what the agent is told: the rows, and the two
 * statements a list can carry.
 */

const say = (phrase: GuidancePhrase | null) => (phrase ? i18n.t(phrase.key, phrase.params) : null)

const row = (itemNumber: string, atp: number | null = 5) => ({
  ...REWARD_RESOLUTION.items[0],
  itemNumber,
  atp,
})

describe('aRewardResolutionMapsToTheQualifyingRows', () => {
  it('maps through the existing qualifying-row mapping, unchanged', () => {
    const view = rewardResolutionView(REWARD_RESOLUTION)
    // 🚩 The same mapping, not a second row model: a second one is a second chance
    // for a price to land in the wrong place.
    expect(view.rows).toEqual(prereqRows(REWARD_RESOLUTION))
    expect(view.rows.map((r) => r.itemNumber)).toEqual(['500062'])
    expect(view.rows[0].meta.map((part) => part.id)).toEqual(['itemNumber', 'description2', 'estimate'])
    expect(view.empty).toBeNull()
    expect(view.truncated).toBeNull()
  })

  it('keeps a degraded stock read as unknown, never as none', () => {
    const view = rewardResolutionView({ ...REWARD_RESOLUTION, items: [row('500062', null)] })
    expect(view.rows[0].availability.kind).toBe('unknown')
  })

  it('slices nothing — the handful is the server’s topN', () => {
    const items = ['1', '2', '3', '4', '5'].map((n) => row(n))
    expect(rewardResolutionView({ ...REWARD_RESOLUTION, items, topN: 3 }).rows).toHaveLength(5)
  })

  it('states a truncated list, like the prerequisite list does', () => {
    const items = ['1', '2', '3'].map((n) => row(n))
    const view = rewardResolutionView({ ...REWARD_RESOLUTION, items, truncated: true })
    expect(say(view.truncated)).toBe('The top 3 at this store — there are more.')
    // An untruncated answer is everything the server had to give.
    expect(rewardResolutionView({ ...REWARD_RESOLUTION, items, truncated: false }).truncated).toBeNull()
  })

  it('says an arm the stock filter emptied is not available at this store', () => {
    const view = rewardResolutionView({ ...REWARD_RESOLUTION, items: [] })
    expect(view.rows).toEqual([])
    expect(say(view.empty)).toBe('Not available at this store.')
    // A wire that omitted the list says the same: there is nothing to offer.
    const omitted = { ...REWARD_RESOLUTION, items: undefined as unknown as typeof REWARD_RESOLUTION.items }
    expect(say(rewardResolutionView(omitted).empty)).toBe('Not available at this store.')
  })

  it('says nothing before the answer arrives — not yet asked is not empty', () => {
    for (const pending of [undefined, null]) {
      const view = rewardResolutionView(pending)
      expect(view.rows).toEqual([])
      expect(view.empty).toBeNull()
      expect(view.truncated).toBeNull()
    }
  })

  it('formats nothing as money — the estimate stays an estimate', () => {
    const view = rewardResolutionView(REWARD_RESOLUTION)
    const estimate = view.rows[0].meta.find((part) => part.id === 'estimate')?.text ?? ''
    expect(estimate).toBe('≈26.09')
    expect(estimate).not.toMatch(/SAR|SR/)
  })
})
