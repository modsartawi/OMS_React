# HITL — ticket 341 (the ACR form header drops its description; the ACR list shows the totals)

## Q: The vitest proof "acr form header renders no description line" — the form component cannot be imported in the node runner (stylesheet + image, no RTL). How is it proven?
**Decision taken:** The header strip was lifted into a data list (`acr-header.ts`) that `CollectionAcr.tsx` draws as listed; the test asserts on that list. The rendered absence is checked by `tools/collection-print-drive.mjs`.
**Why:** It is the only way to meet a vitest proof without adding React Testing Library, which this wave forbids.
**Revisit if:** RTL is installed — a rendering test could then replace the inference.

## Q: Where do the five figures sit on the list, and does Card Slips leave the More-columns tail?
**Decision taken:** All five are default columns, after Collections, in the ticket's order: Cash Sales, Settlement, Net Collected, Card Total, Card Slips. Card Slips moved out of the tail.
**Why:** Story 72 says the supervisor sees what each ACR holds "without opening it".
**Revisit if:** the default grid is now too wide. It is about 2,200px, so on a 1600px screen the five figures need a horizontal scroll. No column was narrowed, pinned or folded away to make room — that is a layout decision for the owner.

## Q: How is the settlement figure drawn?
**Decision taken:** As the signed number the server sends: a surplus kept back is negative (-200.00), a shortage handed over is positive (300.00), with no "+", no absolute value and no word beside it.
**Why:** The ticket says "Settlement keeps its sign as sent".
**Revisit if:** finance reads the sign backwards. The settlement screens (ticket 340) state direction in words rather than by sign, so the two screens now differ; a header hint or tooltip would be a small follow-up.

## Q: Keep a fallback to `netCollectedTotal` for a server that still sends the old name?
**Decision taken:** No fallback. The field is removed from the wire model, the grid, the CSV and the locale.
**Why:** The ticket says the server stopped sending it and to remove the binding; BackOffice's `AcrInquiryModel` carries only the three new figures.
**Revisit if:** any deployed SIS.Api predates BackOffice 1183 — against it Cash Sales, Settlement and Net Collected would all be blank.

## Q: Ticket 336 (Excel export) had not landed. What happens to the ACR CSV?
**Decision taken:** The existing CSV column map follows the grid: Cash Sales and Settlement are new columns before Net Collected, and Card Slips moved up beside Card Total. 19 columns became 21.
**Why:** The CSV map is typed by the grid's field lists and would not compile otherwise.
**Revisit if:** someone reads the ACR export by column position — the positions after Collections shifted. 336 replaces this writer anyway.

## Q: `AcrForm.label` is no longer printed. Remove it from the wire model?
**Decision taken:** Kept, with a note that it is still on the wire but not printed.
**Why:** BackOffice 2160 says the stored value and the document are unchanged; only the header line goes.
**Revisit if:** BackOffice drops `label` from the form document.

## Note: four drive checks were already failing before this ticket
Measured on a stash of this ticket's changes, so they are not caused by it and were left alone:
- `tools/collection-drive.mjs` — "255 — it queries a business date of TODAY" and "255 — Reset returns to today": the ACR list now opens on today's *collection* date (commit b124dfe), and the drive still expects `BusinessDateFrom/To`.
- `tools/collection-print-drive.mjs` — "acr → الموافق restored beside the Gregorian date" and "acr OPEN → تاريخ التحصيل is BLANK": BackOffice 2145 (commit 5324d41) removed the Hijri date and made the collection date never blank; the drive was not updated.

## Note: review findings not acted on
- CONTEXT.md has no entry for Cash Sales, or for "Settlement" as an ACR figure (its only mention of settlement is an "avoid" under Deposit). Same glossary gap HITL-340 logged; one `/domain-modeling` pass after 339 lands would cover both.
- The second header row re-flows from four cells to three, so الحالة and أُغلق بواسطة shift sideways. Order is unchanged. Worth a look in the pending A4 print check.
- Adding a figure to the ACR row still means touching the field lists, the CSV map, the locale and several hand-counted comments.
