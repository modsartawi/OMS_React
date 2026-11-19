/**
 * A bonus buy's minimum and its basis (BackOffice spec 4040), read the same way on every surface:
 * the editor, the inquiry grid and its export, the detail modal and the simulation's near-miss card.
 */
import { formatMoneyIn } from '@/core/money'

/**
 * Whether the minimum is measured including VAT. The mark is the minimum's, so it reads on only
 * beside a minimum above 0; an absent mark (a server or engine from before spec 4040) reads off.
 */
export function minInclVat(header: { minValue?: number | null; minValueInclVat?: boolean | null }): boolean {
  return header.minValueInclVat === true && (header.minValue ?? 0) > 0
}

/** A minimum (or maximum) amount drawn at its currency's own decimals (3 for BHD), without the code. */
export function formatMinAmount(value: number, currency: string): string {
  return formatMoneyIn(value, currency)
}
