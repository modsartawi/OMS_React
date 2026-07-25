// Types for the shared simulation key ledger (ticket 121). The ledger itself is plain
// `.mjs` so `tools/check-sim-keys.mjs` (a Node gate, no build step) and
// `i18n-keys.test.ts` (vitest, TypeScript) can read the SAME list — a ledger maintained
// in two places can go green on a stale copy. This declaration is what that costs.
export const RETIRED: string[]
export const RETIRED_MONEY: string[]
export const UPPERCASE: string[]
