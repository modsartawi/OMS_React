# HITL — ticket 425 (ACRs open blank, new filters, the full ACR number)

## Q: Which open-blank seam, empty state and Reset behaviour does ACRs use?
**Decision taken:** 423's, copied (not extracted), exactly as 424 copied it. The Page's applied criteria are `AcrsCriteria | null`, `null` until the first Search. `acrsParamsFor(null)` answers `null` (vitest: `acr landing has no dates and issues no request`), and `useQuery` is `enabled: appliedParams !== null`. The empty grid says "Press Search to see ACRs" (`acrs.landing.*`), and this state is tested before `isPending`. Reset returns to the un-searched landing: the empty draft with the default Served-by scope, applied `null`, no request. A Search on an unchanged draft re-asks the door (`sameQuery` + `refetch`, copied into `acr-criteria.ts`). The `today` state and every `new Date()` left the ACRs page with the date default.
**Why:** The runner says 425 must copy 423's choice.
**Revisit if:** the owner rules differently on 423.

## Q: "Deposits and Attempts share the collector reading" — the ticket's premise is wrong for Attempts
**Decision taken:** As the runner ruled. ACRs gain ACCOUNTANT. Deposits do NOT offer it. **Attempts are left exactly as shipped.** Since ticket 316 they have been on the `assignment` reading with `accountants: true`, so they already offer ACCOUNTANT. The proof reads "offered on ACRs, not on Deposits, Attempts unchanged" (`served-by.test.ts`: `ACCOUNTANT offered on ACRs, not on Deposits or Attempts`, which pins Attempts' contract and Kinds to their shipped values). BackOffice 2426 (f1907c325) agrees: Deposits keep the refusal, and Attempts keep their store-assignment reading.
**Why:** The ticket's sentence about Attempts describes a table that no longer exists. Changing Attempts would break shipped behaviour that nobody asked to change.
**Revisit if:** the owner wants Attempts to lose ACCOUNTANT. **That ruling is open and is the owner's.**

## Q: How is the ACR exception keyed — split the reading, or per screen?
**Decision taken:** Per screen, via the contract's existing `accountants` flag. `SERVED_BY_SCREENS.acrs` becomes `{ reading: 'collector', accountants: true, freeText: true }`. `resolvedKinds(screen)` returns the reading's list, plus ACCOUNTANT when the contract offers Accountants and the reading lacks it. `RESOLVED_KINDS_BY_READING.collector` is unchanged, and its "absent permanently" comment now names the ACR exception (spec 2423 reverses 1993 for ACRs only). `hasReferent` is untouched, so an accountant still lands on the estate on ACRs.
**Why:** It keeps "the group is shown" and "the Kind resolves" as one fact, which is the invariant the list exists for. Splitting the reading would have to rename a reading that Deposits shares for every other Kind.
**Revisit if:** a second collected-by screen ever needs a different subset of Kinds. A real per-screen Kind list would then be clearer.

## Q: How does an accountant line read in the ACRs combobox (the typed-id box)?
**Decision taken:** It reads "{{name}} (accountant)" (`servedBy.accountantEntry`), mirroring "{{name}}'s team" for supervisors. A bare typed id is still COLLECTOR, even an accountant's id. Only the clicked accountant line asks ACCOUNTANT.
**Why:** A datalist has no groups, so the Kind must be legible from the text alone. A person who both collects and accounts would otherwise be two identical lines, and the first one would win.
**Revisit if:** the owner wants different wording.

## Q: The grid's ACR No# column — which field, and can it be sorted?
**Decision taken:** The default column is now `acrNo`. A value getter shows `acrNo` and falls back to `acrNumber` when `acrNo` is absent or blank (`acr-number.ts`, one rule shared with the header and the deposit lines). `acrNumber` became an argued `NON_COLUMN_FIELDS` entry, so the completeness proof still covers the row and the total stays at 21. **The column is `sortable: false`** and has no comparator. The server's order (month newest first, legacy last) cannot be reproduced by comparing `6498-2610-0001` with `1834` as text or as numbers. The floating filter is the default text filter, on the shown value. The xlsx export writes the shown value as text. The locale key moved from `acrs.columns.acrNumber` to `acrs.columns.acrNo`, with the same "ACR No#" label.
**Why:** The runner says "do not add a client sort or comparator". Leaving the header sortable would add a text sort by default.
**Revisit if:** finance want to sort by number. That needs a server-supplied sort key (e.g. period + number), not a client parse.

## Q: The form header — where does the number come from?
**Decision taken:** `AcrForm` gains optional `acrNo` (BackOffice 2427/2429: the form builder carries `AcrNo`). The رقم التجميعي cell binds `acrNo` and falls back to `acrNumberText` (`AcrHeaderCell.fallback`, `headerCellValue`). It prints inside `<Ltr>` (the new `ltr` flag), because `40219-2606-0003` on the RTL sheet would otherwise read reversed. The fixture's three-page, boundary and open scenarios carry the new form (`40219-2606-0003`, and `acrNumberText: '3'`). The idle one is legacy (`4482` / `4482`).
**Why:** The ticket names the header. The server owns the format, so a fallback is the only client logic.
**Revisit if:** BackOffice 2429 instead changes `acrNumberText` itself to the full form and sends no `acrNo` on the form. Then the fallback already prints it correctly and nothing breaks.

## Q: Toolbar shapes and the ACR No# box
**Decision taken:** ACR No# is a plain text box: no `pattern`, no `inputMode="numeric"`, `dir="ltr"`, monospaced, sent trimmed as typed (`AcrNumber`). A malformed value reaches the door, and its envelope refusal shows through `apiErrorMessage` in the error banner (driven with a stubbed 400). Amount From/To are text boxes (`inputMode="decimal"`), as on 423 and 424, with a title naming what they filter ("Net collected — what the ACR banks"). Profit center and Collector are text boxes. The Collector box ("Id or name") is a CONTAINS match that ANDs with Served by. Its toolbar comment says why it is not the exact-id box 1167 removed.
**Why:** The wire contract says "sent as typed". 423 found that `type="number"` silently drops what it cannot parse.
**Revisit if:** the owner wants client-side amount validation.

## Copy changes
The landing no longer says "today":
- `acrs.loading` → "Loading ACRs…"
- `acrs.errors.loadFailed` → "ACRs could not be loaded."
- `acrs.search.clearFilter` → "Clear the filters and start over" (423's wording, which avoids "Search" in an aria-label)
- `acrs.empty.title` → "No ACRs match this search"
- `acrs.empty.hint` and `acrs.capReached` now name the new filters.
- `acrs.search.acrNumberHint` no longer says "Digits only".

`acrs.landing.hint` says that an untouched Search is limited to what "Served by" covers, which avoids the false claim 424 flagged on 423's hint.

## Note: wire contract vs the committed server
BackOffice 2426 (f1907c325 on `afk/spec2423`) binds `AmountFrom`/`AmountTo` (decimal?), `ProfitCenter` and `CollectorText` on `AcrInquiryOptions`, and answers ACCOUNTANT on ACRs only. This agrees with the oms ticket's contract. 2427/2428 (`acrNo`, text `AcrNumber`) had not landed there when this slice was built. The client builds against the oms ticket verbatim and falls back when `acrNo` is absent.

## Note: drives
- Updated for the blank landing and the new copy: `acr-closed-by-drive` (41/41), `four-filters-drive` (83/83; its ACR block asserted a business-date landing that was already stale before this slice), `collection-drive` (264/264; the two pre-existing ACR failures 423 logged are now fixed), and `foundation-drive` (ACRs added to `SCREEN_ACTIONS`).
- New: `tools/acr-filters-drive.mjs` (37/37), all stubbed.
- Pre-existing failures, unchanged and not caused by this slice: `foundation-drive` 8 (topbar control list ×4, bell's isolated time ×4), and `collection-print-drive` 2 (Hijri, OPEN تاريخ التحصيل).

## /code-review dispositions
- **Fixed:** the accountant combobox label now isolates the name whole (`fsi`), because a datalist option is a string-only sink. ⚠️ The sibling `servedBy.supervisorEntry` (shipped, not this slice) interpolates its name without `fsi`. Left alone for the owner or a bidi sweep.
- **Fixed:** the ACR No# column dropped a `filterValueGetter` that repeated its `valueGetter`. The filter reads the getter (driven: `2610` matches the two October ACRs).
- **Fixed:** `headerCellValue`'s fallback is now the generic "field blank → fallback" and no longer borrows the ACR-number helper.
- **Kept, deliberate:** ACR No# is not sortable (see the column question above). There is also no client validation of Amount or ACR No#. A ProblemDetails binding 400 reads "The request was rejected by the server." through `apiErrorMessage`, which is 423's and 424's posture.
- **Kept, by ruling:** `sameQuery`, and the `appliedParams!` + `enabled` query, are copied from 423 and 424 ("copied, not extracted"). Nothing in the app refetches the `['collection','acrs']` prefix with `type: 'all'`, and `list.refetch()` is only called when `appliedParams !== null`.

## /standards-review dispositions
- **Standards: no hard violations.** Fixed the stale comment in `acr-number.ts` that claimed the form header used it. The rest are judgement calls covered by "copied, not extracted" or by decisions logged above: the `acrsParamsFor` thin wrapper, the duplicated `AmountField`/`sameQuery`, and the `accountants` flag now doing two jobs.
- **Spec: no blocking gaps.**
  - Fixed the stale `api.ts` comment that called `AcrNumber` a filter the server lacks.
  - Fixed a hand-typed accountant label missing its `fsi`-isolated twin: `parseServedByText` now compares labels with isolates stripped, and this is tested.
- **For the owner (unchanged, logged):**
  - ACR No# is no longer sortable, and the bare count is now an argued non-column.
  - The "(accountant)" copy.
  - The fixture assumes a new ACR's `acrNumberText` is the bare monthly count (`'3'`).
  - Amount From > To relies on the server's refusal. 2426 does refuse it (`InquiryAmountRange`, per its `AcrInquiryOptions` comment).
