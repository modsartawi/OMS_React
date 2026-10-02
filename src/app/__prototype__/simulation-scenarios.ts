// THROWAWAY: captured exchanges, not a pricing engine.
import fired from '../../../.issues/assets/098-simulate-payloads/02-fired-bonus-buy.json'
import near from '../../../.issues/assets/098-simulate-payloads/03-near-miss.json'
import plain from '../../../.issues/assets/098-simulate-payloads/01-plain-multiline.json'
import trace from '../../../.issues/assets/098-simulate-payloads/05-pricing-elements.json'
import type { SimulateRequest } from '@/core/models/simulation'
export const scenarios = { fired, near, plain, trace }
export type Scenario = keyof typeof scenarios
export function scenarioRequest(key: Scenario): SimulateRequest {
  const request = structuredClone(scenarios[key]._capture.request) as SimulateRequest
  request.header.pricingDate = request.header.pricingDate.slice(0, 10)
  return request
}
