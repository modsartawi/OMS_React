// oms 694 (BackOffice spec 3271, door 3296): a parameter's list from the workbook's CodeSystem.
// 🚩 STUBBED: the path and the row are guesses, listed on ticket 694 for 711 to reconcile. Labels and counts are invented,
// except that the prototype's four codes keep its census counts.
import { envelope } from './insurance-rules-stubs.mjs'

const SEEN = { 66: 28, 57: 28, 13: 26, 25: 12 }

export const BENEFIT_CATEGORIES = Array.from({ length: 80 }, (_, i) => {
  const code = String(i + 1)
  return { code, label: { en: `Benefit category ${code}`, ar: `فئة المنفعة ${code}` }, census: SEEN[code] ?? 0 }
})

/** `GET InsuranceRules/Fields/Catalog/Parameters/category`, or null to fall through. `deny` with 'parameter' answers a bare 403. */
export function fhirParameterStub(method, path, opts = {}) {
  if (path !== 'InsuranceRules/Fields/Catalog/Parameters/category' || method !== 'GET') return null
  if (opts.reads) opts.reads.parameter = (opts.reads.parameter ?? 0) + 1
  if (opts.deny?.includes('parameter')) return { status: 403, contentType: 'application/json', body: '' }
  return envelope(BENEFIT_CATEGORIES)
}
