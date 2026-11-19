/** The pattern screens' addresses (oms 922; `app/insurance-routes.tsx` mounts them). */
export const PATTERNS_PATH = '/insurance/patterns'

/** A case's screen. The case id is a ULID, escaped all the same. */
export const casePath = (caseId: string) => `${PATTERNS_PATH}/${encodeURIComponent(caseId)}`
