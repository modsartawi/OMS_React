# HITL log — ticket 437 (Cities & districts imports)

## Q: What line number does the preview and the skipped result use when the file has blank lines?
**Decision taken:** empty lines are dropped before numbering (D14), so a line's number is its position among the lines SENT. The preview shows the same numbers the server reports in `skipped[].line` (D8: "the 1-based line of the file as sent").
**Why:** the server only sees `lines[]`; the preview and the result must agree.
**Revisit if:** the owner wants the physical file line numbers (they differ from these when the file has blank rows); BO-7 would then need the client to send each line's file number.

## Q: A line whose extra column is empty (`RUH\tRiyadh\tالرياض\t`) — upsert, as WPF did, or error?
**Decision taken:** error (COLUMN_COUNT), and the import is blocked until it is fixed.
**Why:** D14 verbatim: "Column count must equal the spec's, or the spec's plus one when the extra is `X`. Otherwise the line is an error."
**Revisit if:** users copy a 4-column Excel range where only some rows hold X (the others paste with a trailing tab). Accepting an empty extra cell as "not delete" would be a one-line change in `@/core/import/parse-import.ts`.

## Q: Is `X` matched with surrounding whitespace, and are values trimmed?
**Decision taken:** no. `X`/`x` must be the whole cell; every value is sent as written (no trim, no upper-casing — D14 says the server upper-cases codes). A row of only spaces/tabs is not empty, so it shows as an error line.
**Why:** WPF parity (WPF compared `== "X"` exactly and sent raw values); the preview makes any such line visible.
**Revisit if:** real files carry `X ` with stray spaces.

## Q: How is a picked file decoded?
**Decision taken:** by BOM as WPF's `StreamReader` does: UTF-16 LE/BE by their BOM, else UTF-8 — and a file that is not valid UTF-8 (Excel's ANSI "Text (Tab delimited)", cp1256) is REFUSED with "save it as Unicode Text", not read.
**Why:** a lenient decode turns every Arabic name into U+FFFD and the import would overwrite real names with it (found by /code-review).
**Revisit if:** users routinely have ANSI files; a cp1256 fallback (TextDecoder('windows-1256')) would read them, but guessing the code page is riskier than refusing.

## Q: Where does the import dialog live — core or the feature?
**Decision taken:** the pure parser (`@/core/import/parse-import`), the result model (`@/core/import/import-result`) and the wire type (`@/core/models/import-result`) are in core, as the ticket and the wave notes name them. The dialog (`ImportDialog.tsx`), its preview columns and its `import.*` strings stay in the geography feature.
**Why:** the ticket graduates "the import parser AND the import-result model"; a core component would also need a core namespace with an Arabic file, which `common` does not have.
**Revisit if:** 438 finds itself copying the dialog wholesale — then graduate it to `@/core/import` with a column spec, a send function and a namespace as props (both /code-review and /standards-review raised this).

## Q: Where are the reasons worded?
**Decision taken:** the core model returns a key (`unknownCity` | `unknownStaff` | `unknownSource`) or `null`; the feature words it in its own namespace. Geography carries all three words so the dialog's `t()` is total, even though it should only ever see `UNKNOWN_CITY`. Any other code is shown as the code, isolated LTR.
**Why:** core is i18n-free; `common` has no Arabic file.
**Revisit if:** a core import dialog is built (see above) — the words move with it.

## Q: What does the dialog say when the send fails, and does it reload?
**Decision taken:** a business refusal (`success:false`) says "The import was refused — nothing was applied" with the server's message; any other failure (network, 5xx) says it "may not have been applied — the lists were reloaded, check them before sending again". Both lists reload after every send, success or failure; the preview is kept so Send can be retried (lines are idempotent upserts/deletes).
**Why:** api-envelope rule (a business outcome is not a crash); a failed send may still have committed.
**Revisit if:** BO-7 returns partial-commit semantics.

## Q: Is the district import offered without a selected city?
**Decision taken:** yes — each district line names its own city, so the Import districts button is there whenever `canImportDistricts` is held.
**Why:** WPF's district import is independent of any selection.
**Revisit if:** the owner wants it tied to the selected city.

## Note: WPF's district import screen also has a "Magento sync" button
It rewrites `OrderDriverCity` from SdDistrict by direct SQL. It is not in spec 430 and was not built.

## Note: CONTEXT.md
"Skipped line" was already a link term (call-center copy). Added **Skipped import line** as its own entry rather than overloading it.

## Note: drive port
Port 5199 was held by a server this session did not start; it was left alone. The drive ran against its own vite on 5237 (`DRIVE_PORT=5237`), killed afterwards.
