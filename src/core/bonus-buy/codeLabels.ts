// Pure code→label resolver for the BBY Inquiry grid + Details modal (spec 061,
// ticket 063). SAP/BBY carries single-letter (and ZB0x) codes; the operator reads
// labels, but CSV export (065) must still dump the raw codes — so this module never
// mutates the row. It maps a code to its `bonus-buy-inquiry` i18n KEY; the render
// tier resolves that key with `t(key, { defaultValue: rawCode })`.
//
// Dependency-free (no `@/` imports, no react-i18next, no network) so it runs in an
// in-memory node/tsx harness — the `list-params` / sim `promoView` precedent.

/** The code sets the grid + modal render as readable labels. Every member has a
 *  backing `<set>.<code>` key in `src/locales/en/bonus-buy-inquiry.json`. */
export const CODE_SETS = {
  /** BBY header status. */
  status: ['A', 'I', 'D', 'X'],
  /** Buy/Get link category — how the side's lines combine. */
  link: ['A', 'O'],
  /** Condition target — the scope the promotion discounts. */
  condTarget: ['R', 'P', 'M', 'G'],
  /** Get-side discount kind (modal). */
  discount: ['P', 'R', '%'],
  /** Get-side condition type (modal). */
  condType: ['ZB01', 'ZB02', 'ZB03', 'ZB12', 'ZB13'],
  /** Get-side scale kind (modal). */
  scale: ['A', 'B', 'C'],
} as const

export type CodeSet = keyof typeof CODE_SETS

/**
 * The i18n key for a code within its set, e.g. `codeLabelKey('status', 'A')` →
 * `'status.A'` (which the JSON maps to "Activated"). An **unknown** code is passed
 * through unchanged (`codeLabelKey('status', 'Z')` → `'Z'`) — never thrown — so a new
 * SAP code degrades to its raw value instead of crashing the grid. Paired with
 * `t(key, { defaultValue: code })` the pass-through renders the raw code verbatim.
 */
export function codeLabelKey(set: CodeSet, code: string): string {
  return (CODE_SETS[set] as readonly string[]).includes(code) ? `${set}.${code}` : code
}
