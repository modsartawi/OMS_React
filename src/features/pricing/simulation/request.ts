import type { SimulateRequest } from '@/core/models/simulation'
import type { SimHeaderState } from './SimHeaderForm'
import type { SimItemRow } from './SimItemsEntry'
import type { SimManualConditionRow } from './SimManualConditions'

/** Everything on screen that a run reads. */
export interface SimRequestInputs {
  header: SimHeaderState
  promotion: boolean
  unactivated: boolean
  pricingElements: boolean
  items: readonly SimItemRow[]
  manualConditions: readonly SimManualConditionRow[]
}

/**
 * The request the inputs on screen describe — Process posts it, and the run strip's chips and the
 * staleness check read it (ticket 113). Out of the Page so it is node-testable (ticket 637).
 *
 * `loyGroups` is the one comma string the core picker writes (or, without the view grant, today's
 * free text — D3); either way blank goes as `null`.
 */
export function buildSimulateRequest({
  header,
  promotion,
  unactivated,
  pricingElements,
  items,
  manualConditions,
}: SimRequestInputs): SimulateRequest {
  const built: SimulateRequest = {
    header: {
      plant: header.plant.trim(),
      salesOrganization: header.salesOrganization.trim(),
      distributionChannel: header.distributionChannel.trim(),
      // A blank date lets the engine use "now"; a set date goes as midnight ISO.
      pricingDate: header.pricingDate ? `${header.pricingDate}T00:00:00` : '',
      documentPricingProcedureKey: header.documentPricingProcedureKey.trim(),
      loyGroups: header.loyGroups.trim() || null,
      loyTier: header.loyTier.trim() || null,
      isPromotionApplicable: promotion,
      skipBonusBuyActivationCheck: unactivated,
    },
    items: items
      .filter((r) => r.materialNumber.trim() !== '')
      .map((r) => ({
        materialNumber: r.materialNumber.trim(),
        quantity: Number(r.quantity) || 0,
        qtyUnit: r.qtyUnit.trim(),
        itemConditionControl: r.itemConditionControl.trim() || null,
      })),
    includeConditions: true,
    includePricingElements: pricingElements,
  }
  // Only rows carrying a condition type ride the request; item number defaults to
  // 0 (a header condition) when blank or non-numeric.
  const validManual = manualConditions.filter((c) => c.conditionType.trim() !== '')
  if (validManual.length > 0) {
    built.manualConditions = validManual.map((c) => ({
      itemNumber: Number(c.itemNumber) || 0,
      conditionType: c.conditionType.trim(),
      rate: Number(c.rate) || 0,
      rateUnit: c.rateUnit.trim(),
    }))
  }
  return built
}
