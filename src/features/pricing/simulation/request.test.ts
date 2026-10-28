import { describe, expect, it } from 'vitest'
import { writeLoyGroupSelection } from '@/core/loy-groups/selection'
import { buildSimulateRequest, type SimRequestInputs } from './request'

/**
 * The request Process posts, built from what is on screen (ticket 637). The basket's loyalty
 * groups are picked with the core picker, which hands back one comma string; the engine binds
 * `SimulateHeaderDto.LoyGroups` as `string[]`, so the request splits it, and no group is `null`.
 */
function inputs(loyGroups: string): SimRequestInputs {
  return {
    header: {
      plant: 'P001',
      pricingDate: '2026-10-27',
      salesOrganization: '1000',
      distributionChannel: '20',
      documentPricingProcedureKey: '',
      loyGroups,
      loyTier: '',
    },
    promotion: true,
    unactivated: false,
    pricingElements: false,
    items: [{ id: 'r1', materialNumber: '107255', quantity: '2', qtyUnit: 'EA', itemConditionControl: '' }],
    manualConditions: [],
  }
}

describe('the simulate request carries the basket loyalty groups', () => {
  it('simulate request carries picked groups as a code array; none → null', () => {
    // What the picker hands back after GOLD then SILVER are ticked.
    expect(buildSimulateRequest(inputs(writeLoyGroupSelection(['GOLD', 'SILVER']))).header.loyGroups).toEqual(['GOLD', 'SILVER'])
    // Every group taken off: the picker writes '', and the request says no group.
    expect(buildSimulateRequest(inputs(writeLoyGroupSelection([]))).header.loyGroups).toBeNull()
    // Without the view grant the field is free text (D3): split on commas, each trimmed, blanks dropped.
    expect(buildSimulateRequest(inputs(' 0001 ')).header.loyGroups).toEqual(['0001'])
    expect(buildSimulateRequest(inputs('gold, 0001,,')).header.loyGroups).toEqual(['gold', '0001'])
    expect(buildSimulateRequest(inputs('   ')).header.loyGroups).toBeNull()
    expect(buildSimulateRequest(inputs(' , ')).header.loyGroups).toBeNull()
  })

  it('builds the rest of the request as Process always posted it', () => {
    expect(buildSimulateRequest(inputs(''))).toEqual({
      header: {
        plant: 'P001',
        salesOrganization: '1000',
        distributionChannel: '20',
        pricingDate: '2026-10-27T00:00:00',
        documentPricingProcedureKey: '',
        loyGroups: null,
        loyTier: null,
        isPromotionApplicable: true,
        skipBonusBuyActivationCheck: false,
      },
      items: [{ materialNumber: '107255', quantity: 2, qtyUnit: 'EA', itemConditionControl: null }],
      includeConditions: true,
      includePricingElements: false,
    })
  })
})
