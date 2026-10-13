# HITL — ticket 477 (Deliverect stores, slice 0 of the area)

## Q: How does the onboard dialog pick the store — a store picker or a typed code?
**Decision taken:** A typed store code (LTR, mono). The server is authoritative: an unknown code is DLV-00001, shown inline at the field.
**Why:** The contract offers no store-list door for this area, and a Deliverect slice may not import another feature's picker; a typed code is the conservative reading of "store and account".
**Revisit if:** The owner wants a store search inside the dialog (it would need a core store lookup).

## Q: Where does the direct-HungerStation warning show once the onboard succeeds?
**Decision taken:** The dialog closes (it succeeded), a success toast fires, and a dismissible attention-tone banner (role=status, never role=alert) stays above the grid with the envelope's own message (in `<bdi>`), falling back to our own sentence when the message is empty.
**Why:** The briefing rules it a WARNING, never an error, and "the dialog still succeeds"; a toast alone would vanish before it is read.
**Revisit if:** The owner prefers the dialog to stay open showing the warning.

## Q: The envelope message is lost by `api.post` — how does the warning reach the screen?
**Decision taken:** Added `api.postEnvelope` to `src/core/api.ts`, the twin of the existing `getEnvelope` (same base, header, 401 and ApiError taxonomy), with two vitest cases.
**Why:** api-envelope rule — every server call goes through core/api; this is the shape getEnvelope already set.
**Revisit if:** —

## Q: The reason length — how is "200 characters" counted?
**Decision taken:** UTF-16 code units after a trim (JS `.length` == .NET `string.Length`), with a live `n / 200` counter; over 200 is refused inline client-side and Confirm stays disabled. No `maxLength` on the textarea, so a pasted reason is never silently truncated.
**Why:** Matches what the C# door most likely compares; an emoji counting two can only make the client stricter, never let through what the server refuses.
**Revisit if:** BackOffice 2616 counts code points / text elements instead.

## Q: What do the sync and status cells show in 477, before 480/481?
**Decision taken:** The columns are absent while every row's block is null (the drive proves it). When present, minimal cells: sync = Active / Paused badge; status = Open / Busy / Closed badge. 480 and 481 replace or extend those cells.
**Why:** The ticket asks 477 to render them "when present"; health and actions are 480's and 481's.
**Revisit if:** —

## Q: What does the account filter offer when Accounts is readable vs refused?
**Decision taken:** Readable: every account key from the read (inactive ones too, so an old filter still works). Refused / failed: the distinct account keys of every store row seen in this page life (remembered across filters, so filtering by one account never shrinks the choice to it), plus the current filter value. In the onboard/move dialogs an inactive account is listed but disabled.
**Why:** The briefing's 403 ruling; "remembered" avoids the list collapsing to the filtered account.
**Revisit if:** Accounts becomes readable on any Deliverect grant (see Contract gap).

## Q: Arabic copy for the new namespace
**Decision taken:** `deliverect-stores` ships en + ar with every key mirrored and all six Arabic plural forms (vitest-checked). "Deliverect" stays in Latin script in Arabic copy.
**Why:** Briefing ruling: the area is bilingual. Note the app's `lng` is still `en` everywhere, so the RTL drive pass proves direction and isolation, not rendered Arabic copy.
**Revisit if:** Owner's eye on the Arabic rendering (outstanding, owner-only).

## Q: Menu leaf labels
**Decision taken:** Group "Deliverect" (last, after Materials); leaf labels Stores / Orders / Catalog / Platforms & terms all in `deliverect-stores:menu.*`; only the Stores leaf is in MENU.
**Why:** Briefing ruling (labels, not dead links).
**Revisit if:** Owner overrules the labels-not-leaves ruling.

## Contract gap

- **Accounts behind `canManageTerms`.** The grant table puts `GET DeliverectWeb/Accounts` behind `DeliverectTerms`, but 477's onboard/move (on `canManageStores`) needs the account list. Built against the door as specified; a 403 falls back to a typed key with the rows' accounts as suggestions (DLV-00003 catches a wrong key), proven in the drive. **Ask:** let `Accounts` (and `Platforms`) ride any Deliverect grant.
- **Move / remove refusals are not listed.** The contract lists refusals only for onboard. 477 shows any refusal from move/remove in the dialog with its code (DLV-00003 inline at the account on move, DLV-00009 inline at the reason). **Ask:** list them in the Stores section.
- **PUT/DELETE answer shapes are unspecified.** 477 reads nothing from them and refetches the list. **Ask:** say what they return (the row, or null).

## Q: The ticket says the group "holds an entry for each probe flag"; the briefing says only the Stores leaf. Which?
**Decision taken:** The briefing's ruling — all four leaf LABELS in `deliverect-stores:menu.*`, only the Stores LEAF in MENU; 478/479/482 append theirs with their pages.
**Why:** A leaf never routes to a page that does not exist; the briefing is overrulable by the owner.
**Revisit if:** The owner wants placeholder leaves now.

## Review notes (code-review + standards-review, applied)
- Fixed: filter change applies the unsubmitted text box; warning cleared when its store is moved/removed; null-safe onboard `data`; editing the reason clears a DLV-00009; unknown store status shown raw and `Ltr`-isolated; `LINKED_FILTERS` / `STORES_KEY` single-sourced; `fieldRefusal` graduated to core; query-param types added for Logs/History/Push/Terms; drive extended (RTL refusal + remove, populated sync/status).
- Left as is: the `figure` helper copy (an app-wide duplicate, not this slice's to graduate); a separate `lucide-react` import line in menu-model.ts (a small appended hunk eases the merge with the spec-470 sibling); Raw door's `receivedAt` (478 owns that ruling per briefing); speculative-looking core types/reads (the briefing requires 477 to model every door).
