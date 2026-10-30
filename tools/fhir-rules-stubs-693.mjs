// oms 693 (BackOffice spec 3271): a code system's codes for a code fact. 🚩 STUBBED: `GET InsuranceRules/CodeSystems/Codes?system=`
// and this row shape are guesses, listed on ticket 693 for 711 to reconcile (3296 loads the labels, no door ticket names the read).
import { envelope } from './insurance-rules-stubs.mjs'

export const OUTCOME_SYSTEM = 'http://nphies.sa/terminology/CodeSystem/adjudication-outcome'
const CODES = {
  [OUTCOME_SYSTEM]: [
    { code: 'approved', label: { en: 'Approved', ar: 'موافق عليه' } },
    { code: 'rejected', label: { en: 'Rejected', ar: 'مرفوض' } },
    { code: 'partial', label: { en: 'Partial', ar: 'جزئي' } },
  ],
}

/** The codes of `?system=`, or null to fall through. */
export function codeSystemStub(method, path, query) {
  if (path !== 'InsuranceRules/CodeSystems/Codes' || method !== 'GET') return null
  return envelope(CODES[query.get('system')] ?? [])
}
