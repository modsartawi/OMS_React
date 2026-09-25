# HITL-318 — decisions taken AFK

Contract read: BackOffice 1996 is `status: done` and has a `## Web contract` section. I cross-checked it against the
committed code on `C:\Work\DMSCO\BackOffice` main: `AssignmentUploadModels.cs`, `CollectionAssignmentUploadEndpoints.cs`
and `CollectionAssignmentUploadService.cs`. **The contract and the code agree field for field**:
- the routes and the multipart parts (`file`; `file` + `contentHash`);
- the preview and commit shapes;
- the six row codes and `HASH_MISMATCH` / `ROW_ERRORS`;
- the `400` codes.

No field the contract does not name was added.

## Q: Where does the upload view live on the assignment page?
**Decision taken:** A dialog, opened by an "Upload a file…" button at the end of the Branches tab's "Assign many
branches at once" bar. It is the settlement `BulkUploadDialog` shape: `Modal`, a file step, a preview step, a done step.
**Why:** The ticket says "an upload view on `CollectionAssignmentPage` … follow the settlement bulk upload's shape". The
file writes branches, so it sits with the other ways of changing many branches. No new route or area was added.
**Revisit if:** finance wants the upload as its own tab or as an addressable `/collection/assignment/upload` path, as
settlement has.

## Q: What does the template contain?
**Decision taken:** The header row alone: `StoreCode,AccountantId,CollectorId` + CRLF, as a CSV named
`collection-assignment-template.csv`. It has **no example rows**, unlike the settlement template. The rule "a blank
cell leaves that side as it is" is stated on screen beside the download.
**Why:**
- The file is all or nothing. An example row left in the sheet would be refused (`UNKNOWN_STORE`) and take finance's
  own rows down with it. The spec review raised this.
- CSV rather than xlsx follows settlement's ruling, because writing xlsx would need a dependency. The door accepts both.

**Revisit if:** finance asks for an xlsx template, or for example rows.

## Q: Is Apply offered on a file that changes nothing?
**Decision taken:** No. When `canCommit` is true but no row has `changes: true`, the screen says "Every branch in this
file already has what the file says" and the button reads "Nothing to apply", withheld.
**Why:** Pressing it would write nothing (`applied: 0`). The contract's rule is "enable Apply only when canCommit".
This is a stricter reading, and it is harmless.
**Revisit if:** someone wants to "apply" an unchanged file as an audit act. There is no stamp for it, so there is
nothing to gain.

## Q: Which refusals use the screen's own words, and which the server's?
**Decision taken:**
- **Row refusals:** the six known codes are keyed off `code`, as the contract asks. They name the store, and for staff
  refusals the staff id and slot. The staff id is read from the row's after-value in that column; the server keeps the
  file's id there.
- **Unknown future codes:** the server's message, **English line only**.
- **`400` errors:**
  - `FileRequired`, `FileTooLarge`, `FileTypeUnsupported` and `ContentHashRequired` get the screen's own sentence.
  - `FileUnreadable` (and the unreachable `NoRows` / `TooManyRows`, plus `AssignmentActorRequired`) shows the server's
    English line, because it names *which* problem.
- **Bare `403`:** "Your account is not allowed to assign branches".
- **Commit refusals:** `HASH_MISMATCH` and a generic refusal use the screen's own words. `ROW_ERRORS` folds its rows
  back onto the preview.

**Why:** The contract says the message is "English, a newline, then Arabic: a fallback only, so key the UI copy off
`code`". The web is English-only. The settlement dialog stacks both languages; this screen does not show the Arabic.
**Revisit if:** the server changes its message format, for example English-only or a different separator.

## Q: How does the Branches grid settle after a commit?
**Decision taken:**
- It invalidates the branches query and refetches, rather than patching from the preview.
- It pins the `appliedStoreCodes` rows on screen with the bulk flows' existing pin, and shows "N branches were changed
  from the file."
- A re-press answer (`applied: 0`) refetches nothing.

**Why:** A blank cell keeps what the branch held *at the commit*, which the preview's after-values may not know if
someone changed that branch in between. The contract allows "re-fetch or patch".
**Revisit if:** the 1394-row refetch proves slow in practice. The patch would then need the server to echo both slots
per applied row.

## Q: How is a re-press kept from applying twice?
**Decision taken:**
- A ref guards the press while a commit is in flight. The drive shows a double-click plus a third click sends one commit.
- After success the dialog shows the done panel and no Apply button.
- An answer that arrives after the dialog was closed and reopened is not drawn. Its applied rows still refresh the grid.
- Going back to the file step clears the chosen file, so the file must be picked again. A handle to a sheet edited on
  disk since it was picked cannot be read by the browser.

**Why:** The server is idempotent, but a second *answer* (`applied: 0`) would overwrite the first on screen. The
last two points came from `/code-review` findings.
**Revisit if:** —
