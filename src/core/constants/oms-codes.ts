/**
 * OMS code → description maps for the Screen 2 Header Conditions tab.
 *
 * ⚠ Read this before adding anything here. An earlier version of this file
 * carried Screen 1's `documentType` / `deliveryType` / `documentSource` /
 * `deliveryDocumentType` maps too. They were **deleted** under 406: the LIST
 * endpoint resolves those columns server-side and returns descriptions, so the
 * maps never once fired on a real row. Only the condition maps below survive,
 * because Screen 2's document endpoint genuinely does return raw codes.
 *
 * Even here the map is a **fallback, not the first choice** — see
 * `describeConditionType`.
 */

/**
 * `ConditionType` fallback map — the partial set the legacy WPF screen resolved.
 *
 * The Angular prototype treats this map as authoritative. It is not: the API
 * populates `conditionDescription`, and on live data the map is strictly worse
 * (see `describeConditionType`). Kept only to cover a row whose description
 * comes back blank.
 */
export const CONDITION_TYPE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  UPRC: 'UnitPrice',
  PTGC: 'GiftCardPayment',
  DFEE: 'DeliveryFees',
  DSPF: 'PromotionDiscount',
  MWST: 'VatPercent',
  VATF: 'VatFixed',
  PTQT: 'QitafPayment',
  PTAR: 'ArbahiPayment',
  PTTM: 'TamaraPayment',
  PTHP: 'HyperPayPayment',
  PTPT: 'PayTabsPayment',
}

/**
 * `ConditionCategory` map. Unlike the condition TYPE, the category has **no
 * `*Description` companion on the model** — the map is the only way to render it
 * as words, so here it leads rather than falls back.
 *
 * `%`, `V` and `E` are intentionally unmapped and shown as-is, matching the WPF.
 */
export const CONDITION_CATEGORY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  B: 'BasicPrice',
  C: 'Price',
  D: 'Discount',
  T: 'Tax',
  F: 'DeliveryFees',
  P: 'Payment',
}

/**
 * Describe a condition type: the API's own `conditionDescription` first, the
 * legacy code map second, the raw code last.
 *
 * A deliberate deviation from the Angular prototype, which reads the map only —
 * **owner-accepted 2026-07-17 after driving it live** (ticket 407 finding 2), so
 * do not "restore parity" by reverting to map-first. Measured over the header
 * conditions of 40 live documents (30 rows, 6 distinct types), the map is worse
 * on every single one:
 *
 * | code | map says | API says |
 * |---|---|---|
 * | `DFEE` (x9)  | `DeliveryFees`     | `Delivery Fees` |
 * | `PTHP` (x12) | `HyperPayPayment`  | `Payment HyperPay` |
 * | `FICS` (x4)  | *(unmapped → raw)* | `International Custom Fees` |
 * | `FBBD` (x3)  | *(unmapped → raw)* | `Beyond Border Delivery Fee` |
 * | `PTPA` (x1)  | *(unmapped → raw)* | `PostToAccount` |
 * | `CPRV` (x1)  | *(unmapped → raw)* | *(blank → raw code)* |
 *
 * So the map degrades 9 of 30 rows to a bare code that the API could name, and
 * renders the other 21 in a spelling the server does not use. Preferring the
 * description is never worse than the prototype: where the API says nothing
 * (`CPRV`), this falls back to exactly the prototype's answer.
 */
export function describeConditionType(
  code: string | null | undefined,
  description?: string | null,
): string {
  const described = (description ?? '').trim()
  if (described) return described
  const trimmed = (code ?? '').trim()
  return trimmed ? (CONDITION_TYPE_DESCRIPTIONS[trimmed] ?? trimmed) : ''
}

/** Resolve a condition category code; unknown codes pass through unchanged. */
export function describeConditionCategory(code: string | null | undefined): string {
  const trimmed = (code ?? '').trim()
  return trimmed ? (CONDITION_CATEGORY_DESCRIPTIONS[trimmed] ?? trimmed) : ''
}
