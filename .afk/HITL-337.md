# HITL — ticket 337 (a people file is uploaded with a preview, then committed)

## Q: "A bare 403 hides the upload, as on the assignment upload." The assignment upload never hides its button. Which wins?
**Decision taken:** Both, one after the other. A BARE 403 (no error code) shows "not allowed to maintain the collection roster" in place of the picker. Once the dialog closes, the "Upload a file…" button is gone from the People tab for the rest of the page's life. A 403 envelope that carries a code shows the server's words and keeps the upload.
**Why:** The ticket says "hides". The assignment dialog only words the 403, so "as on the assignment upload" can only mean the same trigger (the bare 403), not the same response.
**Revisit if:** the owner wants the button left in place, as on the Branches tab. That is one `onForbidden` prop.

## Q: Is Apply offered on a clean file where every row is unchanged?
**Decision taken:** No. It reads "Nothing to apply", as ticket 318 does.
**Why:** The server would accept it as an idempotent no-op that writes nothing. A button that writes nothing reads as if it did something.
**Revisit if:** the ticket's "enabled only when the server says the file can be committed" is meant literally.

## Q: The contract says the template "should say" that Arabic role words are refused. The CSV is header-only.
**Decision taken:** Said on screen beside the download ("ACCOUNTANT, COLLECTOR, or blank — written in English"), not in the file.
**Why:** The file is all or nothing, so any note or example row in it would itself be a refused row. This is 318's ruling.
**Revisit if:** finance works from the downloaded file without opening the dialog.

## Q: The people dialog reuses about 20 of the assignment dialog's generic `assignment.upload.*` keys.
**Decision taken:** Kept. Only the people-specific copy has its own `assignment.peopleUpload.*` keys.
**Why:** The reused sentences say nothing about branches (file hint, "Preview the file again", hash mismatch, 400s). Duplicating them would make two copies that drift apart.
**Revisit if:** the branch dialog's wording is changed. Check the people dialog then too.

## Q: Should the 318 and 337 dialogs share a hook or helpers?
**Decision taken:** No, not in this ticket. The ticket says "Pattern to copy", and 338 is about to change the assignment upload's preview.
**Why:** Extracting a shared hook while 338 changes one side would change both screens' behaviour in a ticket about one.
**Revisit if:** a third preview-then-commit upload lands. That is the point to extract a shared `useUploadDoor` hook.

## Q: Is the in-flight state across a closed and re-opened dialog a defect?
**Decision taken:** Left as in 318. An answer from an earlier opening is not drawn. Its pending flag can briefly hold Preview or Apply in the new opening until that answer lands.
**Why:** It is the precedent's behaviour, and it fixes itself within one request.
**Revisit if:** fixed in both dialogs together.
