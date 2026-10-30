// oms 701 (BackOffice spec 3271, A11; doors 3299 / 3300): the catalog rows of a monitor's other two scopes. 🚩 STUBBED: the census
// decides the real first fields, so every key, type and path here is a guess, listed on ticket 701 for 711 to reconcile.
import { envelope } from './insurance-rules-stubs.mjs'
import { FHIR_CATALOG } from './fhir-rules-stubs-692.mjs'
import { REISSUE_REASON_ROW, monitorStub } from './fhir-rules-stubs-699.mjs'

const row = (moment, key, en, ar, type, fhirPath, extra = {}) => ({
  key,
  label: { en, ar },
  moment,
  level: 'message',
  type,
  unit: null,
  fhirPath,
  cardinality: 'single',
  system: null,
  channels: [{ channel: 'nphies', answer: 'sometimes' }],
  parameter: null,
  choice: null,
  legacy: null,
  retired: false,
  ...extra,
})

/** Reason, category and whether there is payload text. Never the text itself. */
export const COMMUNICATION_ROWS = [
  row('communicationRequest', 'reason', 'Reason', 'السبب', 'code', 'reasonCode.coding.code', { system: 'http://nphies.sa/terminology/CodeSystem/communication-reason' }),
  row('communicationRequest', 'category', 'Category', 'الفئة', 'code', 'category.coding.code', { system: 'http://terminology.hl7.org/CodeSystem/communication-category' }),
  row('communicationRequest', 'payloadTextPresent', 'Has payload text', 'يحتوي على نص', 'flag', 'payload.content.ofType(string).exists()'),
]

/** Per detail, in SAR. */
export const PAYMENT_ROWS = [
  row('paymentReconciliation', 'detail.payment', 'Payment', 'الدفعة', 'money', 'detail.extension.value.ofType(Money)', { unit: 'SAR' }),
  row('paymentReconciliation', 'detail.earlyFee', 'Early fee', 'رسوم السداد المبكر', 'money', 'detail.extension.value.ofType(Money)', { unit: 'SAR' }),
  row('paymentReconciliation', 'detail.nphiesFee', 'Nphies fee', 'رسوم نفيس', 'money', 'detail.extension.value.ofType(Money)', { unit: 'SAR' }),
  row('paymentReconciliation', 'detail.amount', 'Amount', 'المبلغ', 'money', 'detail.amount', { unit: 'SAR' }),
]

export const SCOPES_CATALOG = [...FHIR_CATALOG, REISSUE_REASON_ROW, ...COMMUNICATION_ROWS, ...PAYMENT_ROWS]

/** 699's stub, with the catalog holding all three scopes. Null to fall through. */
export function monitorScopesStub(method, path, store) {
  if (method === 'GET' && path === 'InsuranceRules/Fields/Catalog') return envelope(SCOPES_CATALOG)
  return monitorStub(method, path, store)
}
