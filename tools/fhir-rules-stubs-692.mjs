// oms 692 (BackOffice spec 3271): the FHIR fact catalog, the first rows of the spec with 3262's C1-C5 applied.
// 🚩 STUBBED: no door ticket names the catalog GET (3282 is the closest), so `GET InsuranceRules/Fields/Catalog` and
// this row shape are guesses, listed on ticket 692 for 711 to reconcile. Channel answers are invented for the drive.
import { envelope } from './insurance-rules-stubs.mjs'

const NS = 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/'
const CS = 'http://nphies.sa/terminology/CodeSystem/'
const says = (en, ar) => ({ en, ar })

const channels = (nphies, bupa, waseel, oms) =>
  Object.entries({ nphies, bupa, waseel, oms }).map(([channel, answer]) => ({ channel, answer }))
const EVERYWHERE = channels('answers', 'answers', 'answers', 'answers')
const NPHIES_ONLY = channels('answers', 'never', 'never', 'never')
const PARTIAL = channels('sometimes', 'never', 'sometimes', 'never')

const row = (moment, level, key, en, ar, type, fhirPath, o = {}) => ({
  key,
  label: says(en, ar),
  moment,
  level,
  type,
  unit: o.unit ?? null,
  fhirPath,
  cardinality: o.cardinality ?? 'single',
  system: o.system ?? null,
  channels: o.channels ?? NPHIES_ONLY,
  parameter: o.parameter ?? null,
  choice: o.choice ?? null,
  legacy: o.legacy ?? null,
  retired: false,
})
const elig = (...a) => row('eligibility', 'message', ...a)
const claim = (...a) => row('claim', 'message', ...a)
const claimLine = (...a) => row('claim', 'line', ...a)
const resp = (...a) => row('claimResponse', 'message', ...a)
const respLine = (...a) => row('claimResponse', 'line', ...a)

const SITE = `${NS}extension-siteEligibility`
const NOT_IN_FORCE = `${NS}extension-not-in-force-reason`
const OUTCOME = `extension('${NS}extension-adjudication-outcome').value.ofType(CodeableConcept)`
const COVERAGE = '%rootResource.entry.resource.ofType(Coverage)'
const ITEM = 'insurance.item.where(category.coding.code = %code)'
/** C5: `benefit.allowed` is a choice of these three, and the phase-1 number keys convert all of them. */
const ALLOWED = ['unsignedInt', 'string', 'money']
const perCategory = { parameter: 'category' }
const allowedNumber = { ...perCategory, choice: ALLOWED }
const adjudication = (code) => `adjudication.where(category.coding.code = '${code}').amount`

export const FHIR_CATALOG = [
  // The phase-1 eligibility keys, names and types unchanged (spec 3271 F3): a rule that uses them opens as before.
  elig('coverage.class', 'Coverage class', 'فئة التغطية', 'text', `${COVERAGE}.class.where(type.coding.code = 'class').value`, { channels: EVERYWHERE }),
  elig('coverage.periodEnd', 'Coverage ends on', 'نهاية التغطية', 'date', `${COVERAGE}.period.end`, { channels: EVERYWHERE }),
  elig('benefit.dayBenefit', 'Day benefit', 'منفعة اليوم', 'number', `${ITEM}.benefit.where(type.coding.code = 'day-benefit').allowed`, { unit: 'SAR', choice: ALLOWED }),
  elig('benefit.genericCopayPct', 'Generic copay', 'تحمّل الجنيس', 'number', `${ITEM}.benefit.where(type.coding.code = 'copay-percent').allowed`, { unit: '%', choice: ALLOWED }),
  // C3: both levels, codes made distinct; two different codes in one answer read as unparsed, never as a guess.
  elig('response.siteEligibility', 'Site eligibility', 'أهلية الموقع', 'code', `(extension('${SITE}') | insurance.extension('${SITE}')).value.ofType(CodeableConcept).coding.code.distinct()`, { system: `${CS}siteEligibility` }),
  elig('response.inForce', 'Policy in force', 'الوثيقة سارية', 'flag', 'insurance.inforce', { channels: channels('answers', 'answers', 'never', 'never') }),
  // C2: at the response root, never under `insurance`; its CodeSystem was removed in V4 and payers still send it.
  elig('response.notInForceReason', 'Not-in-force reason', 'سبب عدم السريان', 'code', `extension('${NOT_IN_FORCE}').value.ofType(CodeableConcept)`, { system: `${CS}not-in-force-reason`, channels: channels('sometimes', 'never', 'never', 'never'), legacy: { removedOn: '2022-04-20', replacement: 'response.siteEligibility' } }),
  elig('coverage.copayPctQty', 'Copay % on the policy', 'نسبة التحمل في الوثيقة', 'quantity', `${COVERAGE}.costToBeneficiary.where(type.coding.code = 'copaypct').value.ofType(Quantity)`, { unit: '%' }),
  elig('coverage.maxCopay', 'Maximum copay on the policy', 'الحد الأعلى للتحمل في الوثيقة', 'money', `${COVERAGE}.costToBeneficiary.where(type.coding.code = 'maxcopay').value.ofType(Money)`),
  elig('benefit[*].copayPct', 'Copay % for a benefit category', 'نسبة التحمل لفئة المنفعة', 'number', `${ITEM}.benefit.where(type.coding.code = 'copay-percent').allowed`, { ...allowedNumber, unit: '%' }),
  elig('benefit[*].allowed', 'Allowed value for a benefit category', 'القيمة المسموحة لفئة المنفعة', 'number', `${ITEM}.benefit.allowed`, allowedNumber),
  elig('benefit[*].network', 'Network for a benefit category', 'الشبكة لفئة المنفعة', 'code', `${ITEM}.network`, { ...perCategory, system: `${CS}benefit-network` }),
  elig('errors', 'Error codes', 'رموز الأخطاء', 'code', 'error.code', { cardinality: 'list', system: `${CS}adjudication-error` }),

  claim('total', 'Request total', 'إجمالي الطلب', 'money', 'total', { channels: EVERYWHERE }),
  claim('diagnoses', 'Diagnoses (ICD-10-AM)', 'التشخيصات', 'code', 'diagnosis.diagnosis.ofType(CodeableConcept)', { cardinality: 'list', system: 'http://hl7.org/fhir/sid/icd-10-am' }),
  claim('hasAttachment', 'Has an attachment', 'يوجد مرفق', 'flag', "supportingInfo.where(category.coding.code = 'attachment').exists()"),
  claimLine('quantity', 'Quantity requested', 'الكمية المطلوبة', 'number', 'quantity.value', { channels: EVERYWHERE }),
  claimLine('net', 'Line net amount', 'صافي البند', 'money', 'net'),
  // C4: names its extension; `extension.value` would match any item extension.
  claimLine('selectionReason', 'Pharmacist selection reason', 'سبب اختيار الصيدلي', 'code', `extension('${NS}extension-pharmacist-Selection-Reason').value.ofType(CodeableConcept)`, { system: `${CS}pharmacist-selection-reason` }),

  resp('outcome', 'Adjudication outcome', 'نتيجة التحكيم', 'code', OUTCOME, { system: `${CS}adjudication-outcome` }),
  resp('errors', 'Error codes', 'رموز الأخطاء', 'code', 'error.code', { cardinality: 'list', system: `${CS}adjudication-error` }),
  respLine('outcome', 'Line outcome', 'نتيجة البند', 'code', OUTCOME, { system: `${CS}adjudication-outcome` }),
  respLine('approvedQuantity', 'Approved quantity', 'الكمية الموافق عليها', 'number', "adjudication.where(category.coding.code = 'approved-quantity').value"),
  respLine('benefit', 'Payer pays (benefit)', 'ما تدفعه الجهة', 'money', adjudication('benefit')),
  // C1: `copay` stands: HL7 R4 and all 14 payers that send it spell it so. The workbook's `coPay` is the error.
  respLine('copay', 'Line copay', 'تحمل البند', 'money', adjudication('copay'), { channels: PARTIAL }),
  respLine('reasons', 'Adjudication reasons', 'أسباب التحكيم', 'code', 'adjudication.reason', { cardinality: 'list', system: `${CS}adjudication-reason` }),
]

/** `GET InsuranceRules/Fields/Catalog`, or null to fall through. `deny` with 'catalog' answers a bare 403. */
export function fhirCatalogStub(method, path, opts = {}) {
  if (path !== 'InsuranceRules/Fields/Catalog' || method !== 'GET') return null
  if (opts.reads) opts.reads.catalog = (opts.reads.catalog ?? 0) + 1
  if (opts.deny?.includes('catalog')) return { status: 403, contentType: 'application/json', body: '' }
  return envelope(opts.rows ?? FHIR_CATALOG)
}
