/**
 * A patient key as HQ keeps it (BackOffice spec 4015, ADR 0140; mirrors `PatientKeys.Normalise`): a National ID or
 * Iqama is the bare 10 digits from 1 or 2; any other NPHIES identifier type is `TYPE:VALUE`, where TYPE is VP, BN, DP
 * or PPN and VALUE is up to 16 letters or digits (e.g. `BN:4668104765`). `NI:` / `PRC:` are not keys: those are bare.
 */
const NATIONAL_ID_OR_IQAMA = /^[12]\d{9}$/
const VALUE = /^[A-Z0-9]{1,16}$/
export const TYPED_PATIENT_ID_TYPES = ['VP', 'BN', 'DP', 'PPN'] as const

/** The key an admin typed, made the key HQ stores (trimmed, upper case), or null when it is not one. */
export function normalisePatientKey(text: string): string | null {
  const typed = text.trim()
  const colon = typed.indexOf(':')
  if (colon < 0) return NATIONAL_ID_OR_IQAMA.test(typed) ? typed : null
  const type = typed.slice(0, colon).trim().toUpperCase()
  const value = typed.slice(colon + 1).trim().toUpperCase()
  if (!(TYPED_PATIENT_ID_TYPES as readonly string[]).includes(type)) return null
  return VALUE.test(value) ? `${type}:${value}` : null
}

export const isPatientKey = (text: string): boolean => normalisePatientKey(text) !== null
