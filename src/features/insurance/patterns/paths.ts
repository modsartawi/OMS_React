/** The pattern screens' addresses (oms 922; `app/insurance-routes.tsx` mounts them). */
export const PATTERNS_PATH = '/insurance/patterns'

/** A case's screen, by its case number (BackOffice 4053's INT). Escaped all the same. */
export const casePath = (caseNumber: string) => `${PATTERNS_PATH}/${encodeURIComponent(caseNumber)}`

/** The largest case number the server's `{number:int}` route takes (Int32). */
const MAX_CASE_NUMBER = 2_147_483_647

/**
 * The case number an address names, as its plain decimal string (`' 0123 '` → `'123'`); null when it is not a positive
 * whole number the server's `{number:int}` route takes. A null is never asked for: the screen says the case is not
 * found instead (the server would answer a bare 404).
 */
export function caseNumberOf(param: string | undefined): string | null {
  const typed = (param ?? '').trim()
  if (!/^\d+$/.test(typed)) return null
  const n = Number(typed)
  return Number.isSafeInteger(n) && n >= 1 && n <= MAX_CASE_NUMBER ? String(n) : null
}
