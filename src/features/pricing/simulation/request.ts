import type { SimulateRequest } from '@/core/models/simulation'
import type { SimHeaderState } from './SimHeaderForm'
import type { SimItemRow } from './SimItemsEntry'
import type { SimManualConditionRow } from './SimManualConditions'

/** The comma string split into codes, each trimmed, blanks dropped; none → `null`. */
function loyGroupCodes(value: string): string[] | null {
  const codes = value.split(',').map((code) => code.trim()).filter((code) => code !== '')
  return codes.length > 0 ? codes : null
}

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
 * `loyGroups` is held as the one comma string the core picker writes (or, without the view grant,
 * free text — D3) and sent as the code array the engine binds; no code at all goes as `null`.
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
      loyGroups: loyGroupCodes(header.loyGroups),
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
