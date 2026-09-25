# HITL-312 — decisions taken AFK

Contract read: BackOffice 1984 (`status: done`, `## Web contract` present; its own blocker 1983 is done). Cross-checked
against committed source on `C:\Work\DMSCO\BackOffice` main: `CollectionReceiptDocument.DeductionDescriptionText`
(string, default `""`) is set by `CollectionReceiptDocumentService` from the model getter
`CollectionVoucherModel.DeductionDescriptionText`. That getter returns `""` unless the page is a settlement or spent a
surplus, and it trims. **No disagreement between contract and code.**

## Q: Where is the vitest seam for a component that "computes nothing"?
**Decision taken:** A pure `voucher-box.ts` (`voucherBox(page)`) maps the three box strings to `string | null`, with
`''` becoming `null`. `CollectionVoucher` draws a line only for a non-null occupant. `voucher-box.test.ts` pins:
- the ordinary day draws no line;
- both described page kinds carry their text;
- a description-less page prints the entry number alone;
- the text passes through verbatim, all 200 characters.

**Why:** The ticket's Proof asks for vitest, and RTL is ruled out for this wave. The collapse rule is the only logic
in the box, so it is what the module holds.
**Revisit if:** the hardening ticket adds RTL. The module could then fold back into the component.

## Q: How wide does the description wrap?
**Decision taken:** It wraps at `max-width: 340px`, which is the WPF `TextBlock`'s `MaxWidth="340"`. It also has
`overflow-wrap: anywhere`, so a 200-character run with no spaces still wraps. The line is red, not bold, with a 2px top
margin, copied from the WPF.
**Why:** The contract says "the same way as the POS paper". The WPF comment says the MaxWidth keeps the box inside the
sheet's right half.
**Revisit if:** the paper test (a human eye on A4) wants a wider box.

## Q: Which direction does a description in either script take?
**Decision taken:** The line has `dir="auto"`, and the stylesheet sets `text-align: right` (physical, under the
facsimile's documented exemption). An English-only description resolves LTR, so its full stop stays at its end. It
still aligns to the box's right edge like the caption and the entry.
**Why:** The WPF renders it inside the RTL flow. That would move an English line's trailing punctuation to the front.
The date line already set the precedent: an LTR island where the WPF is wrong.
**Revisit if:** the owner wants strict WPF parity. Then drop `dir="auto"` and the `text-align`.

## Q: Should the client hide a description on an ordinary day if one ever arrives?
**Decision taken:** No. The client renders whatever non-empty string the server sends.
**Why:** The contract says the client must not re-derive the text. The server getter already returns `""` on a day
that spent no surplus.
**Revisit if:** a live receipt ever shows text on an ordinary day. That is a server fault to fix there.

## Note: `collection-print-drive.mjs` was already stale
Before this ticket, the drive's fixture-count guard expected 6 receipts. There have been 7 since the settlement fixture
was added, so the drive threw before its first assertion. The count is now 9 (7 plus 312's two described pages). With
only the count corrected, the baseline was 104/104. After this ticket it is 151/151.
