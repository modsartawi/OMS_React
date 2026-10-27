/**
 * Ticket 3149 — the before/after a consultant confirms: only the fields that changed, in the detail's group order,
 * compared as the server compares them (strings trimmed, numbers by value).
 */
import { describe, expect, it } from 'vitest'
import { changedFields } from './diff'
import { settings } from './test-fixtures'

describe('changedFields', () => {
  it('is empty when nothing changed', () => {
    expect(changedFields(settings(), settings())).toEqual([])
  })

  it('lists only the changed fields, with their before and after', () => {
    const before = settings()
    const after = settings({ isPickedOnOrder: true, deliveryFees: 12.25, description: 'Bupa insurance' })
    expect(changedFields(before, after)).toEqual([
      { field: 'description', before: 'Bupa', after: 'Bupa insurance' },
      { field: 'deliveryFees', before: 0, after: 12.25 },
      { field: 'isPickedOnOrder', before: false, after: true },
    ])
  })

  it('follows the detail group order, not the order the edits were made', () => {
    const after = settings({ acceptanceRequired: true, defaultCustomer: '3795407', documentPricingProcedure: '2' })
    expect(changedFields(settings(), after).map((c) => c.field)).toEqual([
      'defaultCustomer',
      'documentPricingProcedure',
      'acceptanceRequired',
    ])
  })

  it('ignores white space at either end, as the server does', () => {
    expect(changedFields(settings({ defaultCustomer: '3795407' }), settings({ defaultCustomer: ' 3795407  ' }))).toEqual([])
  })

  it('compares amounts by value', () => {
    expect(changedFields(settings({ deliveryFees: 15 }), settings({ deliveryFees: 15.0 }))).toEqual([])
    expect(changedFields(settings({ deliveryFees: 15 }), settings({ deliveryFees: 15.5 }))).toHaveLength(1)
  })
})
