/** Ticket 556 — the repeatable-filter helpers, graduated from the Deliverect orders monitor. */
import { describe, expect, it } from 'vitest'
import { keyChoices, toggled } from './filter-choices'

describe('toggled', () => {
  it('switches one key on or off, keeping the rest', () => {
    expect(toggled(['failed'], 'pending')).toEqual(['failed', 'pending'])
    expect(toggled(['failed', 'pending'], 'failed')).toEqual(['pending'])
  })
})

describe('keyChoices', () => {
  it('the read when it answered, else the rows’ keys; the selected always kept, sorted, distinct', () => {
    expect(keyChoices(['OlaCare', 'AlDawaa'], ['X'], [])).toEqual(['AlDawaa', 'OlaCare'])
    expect(keyChoices(undefined, ['OlaCare', 'AlDawaa', 'OlaCare'], ['Zed', null])).toEqual(['AlDawaa', 'OlaCare', 'Zed'])
    expect(keyChoices(undefined, [], [])).toEqual([])
  })
})
