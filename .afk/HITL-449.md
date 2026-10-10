# HITL log — ticket 449 (sync console onboarding: New store wizard, Sync pending, Edit store / Edit location)

## Q: Contract drift — the envelope's error entries
**Decision taken:** Same as HITL-445…448: the drive stubs the REAL SIS.Api envelope `errors: [{ errorCode, errorMessage, internalErrorCode }]`, not the contract's abbreviated `{ code, message }`. Whole refusals are read only through `apiErrorCode` / `apiErrorMessage`; the per-row `results[].error` of `ActionSync/Locations` and `Store/Onboard` is read as the plain code string the contract describes (`BAD_CODE`, `NO_STORE`, `LOCATION_EXISTS`, `NO_TEMPLATE`, `DUPLICATE_IN_BATCH`, `STORE_EXISTS`).
**Why:** `src/core/api.ts` is the one reader of the envelope.
**Revisit if:** BackOffice 2541/2542 really ship `{ code, message }`.

## Contract gap: a new location's connection test cannot be fetched by id
**Decision taken:** `ActionSync/Locations` names each created row's `connectionTestCommandId` but not its batch, and `GET ActionSync/Commands` filters by status, batch, code and kind, not by id. The wizard reads `GET ActionSync/Commands?kind=ConnectionTest&page=1&pageSize=200` (the door's largest page), every 2 s for up to 60 s (448's `pollUntilTerminal`), and picks out its own ids. An id it cannot find yet counts as still testing, so a miss ends in "Still testing", never in "failed". No field was invented.
**Why:** It is the only read the contract offers. A request holds at most 50 stores, so its tests are inside the newest 200 unless 150 or more other tests are queued in the same minute.
**Revisit if:** The Locations answer gains a `batchId` (then poll `?batch=`, as 448 does), or the Commands door gains an `id` filter.

## Contract gap: `Store/Onboard` names no connection test
**Decision taken:** An `OnboardResult` has `warning` but no `connectionTestCommandId`. The result grid shows the door's `warning` as it came, on a warning badge ("Could not connect yet"), and follows nothing for the master wizard. A row with a warning is still counted as created, not failed.
**Why:** The contract gives only `warning: string | null` here, and says a failed test "is shown as a warning only".
**Revisit if:** BackOffice 2542 queues the test asynchronously and `warning` is always null at answer time. Then the Onboard answer needs the test's command id, as Locations has.

## Contract gap: no door reads a store's address back
**Decision taken:** Edit store opens with the description filled (from the store header) and every other field (city, area, address, phone, CR) empty. Save is offered only when EVERY field is filled (`storeEditReady`), and the dialog's note says the current address cannot be read here. Nothing is sent blank.
**Why:** `POST Store/Edit` takes all six fields. Sending one the user never saw would wipe what is stored.
**Revisit if:** BackOffice adds a store-master read, e.g. `GET Store/Master?code=`. Then prefill the form and drop the all-required rule. OWNER SIGN-OFF wanted on the interim form.

## Q: Where do Edit store and Edit location live, and who sees them?
**Decision taken:** Edit location is a button under the Location tab, shown only with `canOperate` (the door is `ActionSync.Operate`). Edit store is a button in the store page's header block, below the controls, shown only with `canOnboard`, and never on a WPF store. Both are absent, not disabled, without their grant.
**Why:** The wave rules: canOnboard gates Edit store; a WPF store's only controls are Move to worker and Test connection; and a WPF store has no Location tab (446's ruling).
**Revisit if:** The owner wants Edit store on WPF stores too, since the store master does not depend on the host.

## Q: Where does the New store wizard start for each grant?
**Decision taken:** `wizardStart(access, finishCode)`:
- Finish (a `?code=`) with `canOperate` → step 2 alone (`ActionSync/Locations`).
- otherwise `canOnboard` → step 1 then step 2 (`Store/Onboard`, `alsoCreateLocation: true`).
- otherwise `canOperate` → step 2 alone.
- neither → no form: a one-line note, and the console bar hides its New store link.

In the master wizard, a `canOperate` holder also gets the prototype's "The store already exists: go to step 2". A `canOnboard`-only holder who opens `?code=X` gets the master wizard with X typed in (not locked).
**Why:** Ticket: "step 1 renders only with canOnboard; without it, the wizard starts at step 2". The wave fact: "With canOnboard the wizard posts Store/Onboard/Preview then Store/Onboard (alsoCreateLocation true)".
**Revisit if:** A `canOnboard`-only holder must be able to create a store master alone. With `alsoCreateLocation: true` the door may refuse the location half for want of `ActionSync.Operate`; the contract does not say. Then send `alsoCreateLocation: canOperate` and make IP / template optional. OWNER / BackOffice 2542 to confirm.

## Q: Is the reason typed in the wizard or in a dialog?
**Decision taken:** Inline, on step 2, beside Preview and Create, with the same rule as the shared dialog (`reasonReady`: not blank once trimmed, sent trimmed). Preview needs it, because the preview body carries it. As in 448, the reason is not part of the preview's inputs.
**Why:** The prototype puts the reason in the wizard's form. The preview and the create both carry it, and a dialog over a full-page form would hide the rows being created.
**Revisit if:** The owner wants Create to open the shared reason dialog.

## Q: Must Create wait for a fresh preview?
**Decision taken:** Yes, as 448's re-push does. The preview is keyed on the inputs SENT: mode, rows, template store and template location. Any change marks it stale and disables Create until a fresh preview. Create posts the same inputs with the real door (`Store/Onboard`, or `ActionSync/Locations` with `preview: false`). It is offered when at least one previewed row is ok.
**Why:** Ticket: "Preview, then Create". A review found that keying on the inputs at answer time let an edit made during the preview's flight pass as fresh, so the key now travels with the request.
**Revisit if:** The owner wants Create without a preview.

## Q: Paste many — format, header, limits
**Decision taken:**
- **Separator:** tab-separated when the first line holds a tab, else CSV. Double quotes may wrap a cell holding a comma.
- **Header:** the first line is skipped as a header when its first cell reads `code` / `store code` (any case) AND another cell reads like a column name (`description`, `ip`, `city`…). `CODE` alone is a valid store code, so a real store `CODE` is never dropped.
- **Columns:** the master wizard pastes code, description, city, area, address, phone, CR, IP (both steps in one line). Step 2 alone pastes code, description, IP.
- **Cleaning:** cells are trimmed and never re-cased.
- **Marks, before any call:** wrong cell count, empty / lowercase / badly formed code, a code repeated on an earlier row, empty IP. Any marked row keeps Next and Preview disabled, and nothing is sent.
- **Limit:** at most 50 rows, though the location door takes 200 ("nothing over 50 stores in one request", ruled).
- **Reuse:** `@/core/import/parse-import` was NOT reused. It is WPF's tab-only format with no header skip, and changing it would change its callers.
**Why:** The ticket's "TSV or CSV, a header row skipped, blank lines ignored, bad codes marked before any call", and the wave's 50 cap.
**Revisit if:** The owner pastes from a source with semicolons, or wants a bad row skipped instead of blocking the paste.

## Q: Which step-1 fields are required?
**Decision taken:** Only the code (live format check), the template store, the IP and the template location. Description, city, area, address, phone and CR may be blank, and the door decides.
**Why:** The contract requires only `ip` (with `alsoCreateLocation`). A client-only rule would be invented.
**Revisit if:** BackOffice 2542 requires the address fields, or the owner wants the wizard to insist on them, as Edit store does for its own reason.

## Q: Dismiss with a selection kept across pages
**Decision taken:** The pending list reuses the Fleet's selection: up to 50 codes, kept across pages and refreshes, the 51st refused through 447's one `selectionCap` (the hook is now shared as `useCappedSelection`). The reason dialog lists every selected code. The door answers with one `auditId` and no per-row result, so the toast says how many were sent, the list refetches, and the selection is cleared.
**Why:** The wave: "449's pending Dismiss reuses that helper". The contract's Dismiss has no per-row answer.
**Revisit if:** A code finished by someone else while still selected makes the whole Dismiss refused. Then prune the selection on refetch, or the door should answer per row.

## Q: Finish from Sync pending
**Decision taken:** Finish (shown only with `canOperate`) navigates to `/admin/sync/new-store?code=<code>`, carrying the row's description as router state. The wizard opens at step 2 with the code locked and the description filled, and offers no Paste many: a Finish is the one store it names.
**Why:** Ticket: "Finish (opens the wizard at step 2 for that code)". The prototype's "Add to sync" link.
**Revisit if:** The owner wants Finish to be an in-page dialog on the pending list.

## Q: Shared 445–448 code touched
**Decision taken:**
- The Fleet page's cap-aware grid selection (447) was moved into `useCappedSelection.ts`, unchanged in behaviour, so Sync pending reuses it. The fleet (38/38), store (65/65), controls (67/67) and commands (68/68) drives were re-run green. One run of the commands drive missed one timing check, "30 reads" read 29; the re-run was 68/68.
- `failureLabelKey` knows the five onboarding codes.
- `ConsoleNav` gained New store and Sync pending.
- `LocationTab` gained Edit location; `StorePage` gained Edit store.
- The model file gained the onboarding shapes.
**Why:** The wave rule is to reuse the one cap, reason dialog and result summary rather than grow new ones.
**Revisit if:** —
