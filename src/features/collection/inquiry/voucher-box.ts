import type { VoucherPage } from '@/core/models/collection'

/**
 * The red box's occupants (`.cv-overage-box`), line by line — what
 * `CollectionVoucher` draws inside it.
 *
 * The box stacks up to three lines, each from its own server string:
 *   1. the caption (`خصم فائض : ` / `تسوية عجز : `), plus the spent surplus's amount
 *      on a day page;
 *   2. the entry number the branch and finance settle by;
 *   3. the accountant's description of that entry (BackOffice 1984 / ADR 0045).
 *
 * 🔑 An occupant whose string is `''` is `null` here and the voucher draws NO
 * line for it — never an empty one, which would grow the box by a line height
 * and push the sheet below it down on every ordinary receipt. That collapse is
 * the WPF sheet's too (`HasDeductionEntry` / `HasDeductionDescription`).
 *
 * ⚠ Nothing is derived. The server decides which kind of page this is and
 * whether the box has an occupant at all — an ordinary day arrives with every
 * string `''` — and every non-empty value passes through VERBATIM: no trim, no
 * cut at 200, no re-labelling. The caption always draws; it is the form's own.
 */
export interface VoucherBox {
  label: string
  amount: string | null
  entry: string | null
  description: string | null
}

/* Truthy, not `=== ''`: the contract says every string is always present, but a
 * SIS.Api without BackOffice 1984 omits `deductionDescriptionText` altogether, and
 * an `undefined` read as an occupant would draw an empty line on every receipt. */
const occupant = (text: string) => (text ? text : null)

export function voucherBox(page: VoucherPage): VoucherBox {
  return {
    label: page.deductionLabelText,
    amount: occupant(page.surplusAmountText),
    entry: occupant(page.deductionEntryText),
    description: occupant(page.deductionDescriptionText),
  }
}
