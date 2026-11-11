# HITL log — ticket 531 (convert a SAP BBy file)

## Q: A button that opens a hidden `.txt` picker and converts on pick, or a visible file box plus a Convert button (like step 2)?
**Decision taken:** One button, "Convert a SAP BBy file", beside "Download the template"; it opens a hidden `accept=".txt"` picker and a pick converts at once.
**Why:** The ticket names one control beside the template ("It picks a `.txt`, calls …"); a conversion stores nothing, so there is no second step to confirm.
**Revisit if:** The owner wants the picked file name visible before it is sent.

## Q: After a conversion, show the saved file's name?
**Decision taken:** Yes — "Saved as `<DealCode>.xlsx`." (LTR-isolated) above the next-step copy and the "stored nothing" line; nothing else.
**Why:** It tells the author which file in their downloads to open; it is not a report and adds no claim the server did not make.
**Revisit if:** "shows nothing else" is meant literally, down to the file name.

## Q: Next-step wording
**Decision taken:** "Next: open it and review it — the proposed DealCode, the names, and every PRICE value. Read its Convert notes sheet if it has one, then upload it below." plus "The conversion stored nothing, and its notes are only in the workbook."
**Why:** The brief's words, nearly verbatim; DealCode, PRICE and Convert notes are the workbook's own column / value / sheet names.
**Revisit if:** The owner wants plain-language labels instead of the workbook's own names.

## Q: Fallback name when ConvertBby sends no Content-Disposition
**Decision taken:** 530's `campaign-upload.xlsx` constant.
**Why:** The server always names it `<DealCode>.xlsx`; reusing 530's fallback keeps one rule in the feature.
**Revisit if:** A missing name should be treated as an error instead.

## Q: The step 1 hint
**Decision taken:** Edited to "Start from the blank template, or convert the SAP BBy file of a deal into one. …".
**Why:** The step now has two ways to get a workbook; the hint described only one.
**Revisit if:** The owner prefers 530's hint unchanged.
