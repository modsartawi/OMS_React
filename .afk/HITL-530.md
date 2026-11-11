# HITL log — ticket 530 (campaign upload: template, read, all-or-none report)

## Q: Port 5199 was already held by a vite server this run did not start (PID 23044, up since 2026-10-18). Kill it?
**Decision taken:** Left it alone; the drive ran against a fresh vite on port 5299 (`DRIVE_PORT=5299`), killed by its port PID afterwards.
**Why:** It is someone else's server (another worktree or the human's); killing it could lose their work.
**Revisit if:** That server was a leftover of an earlier AFK run and should be cleaned up.

## Q: Where does the `campaign-upload.xlsx` fallback name live — in core's POST blob request or in the feature?
**Decision taken:** Core's `api.postBlob` returns `filename: null` when `Content-Disposition` is absent, as `api.blob` does; the feature's `api.ts` applies `CAMPAIGN_UPLOAD_FALLBACK_NAME` (`campaign-upload.xlsx`), tested in `features/campaigns/uploads/api.test.ts`.
**Why:** `core/` must not learn one feature's file name; 531 lives in the same feature folder and reuses the constant.
**Revisit if:** A second feature needs the same POST file door and the same fallback.

## Q: Mechanic and stacking words (`percentOff`, `buyNGetMFree`, `compete`, `stacks`) — translate them or show them as sent?
**Decision taken:** Shown as sent (LTR-isolated) in the tiles, header and grids: they are the workbook's own dropdown words, which the marketer types and reads in the sheet, and the list is open (an unlisted mechanic renders as-is).
**Why:** The most conservative choice: the word on screen matches the word in the file, and no label can be wrong for a value HQ adds later.
**Revisit if:** The owner wants human labels ("Percent off"), which would be keys with the raw word as the fallback.

## Q: Errors and warnings — two tables (brief) or one grid (ticket)?
**Decision taken:** One AG Grid with a Kind column (Error red, Warning amber), errors first in HQ's order, sortable, filterable by sheet, per the ticket. A user's own column sort may mix the kinds.
**Why:** The ticket settled it ("errors and warnings as one AG Grid").
**Revisit if:** The owner wants the kinds kept apart under any sort.

## Q: Extra tiles beyond the brief's list?
**Decision taken:** Added Errors, Warnings and "Arabic names generated" counts beside campaigns / per-mechanic / SKUs / window.
**Why:** The brief asks that generated names be visible; the error and warning counts restate the grid's size.
**Revisit if:** The owner wants the tile row exactly as the brief lists it.

## Q: `accepted: true, stored: false` — the contract never sends it. What does the screen do?
**Decision taken:** A neutral line ("The file was read, but HQ stored nothing.") and the report; no revision, no "waiting" claim.
**Why:** Never claim an approval request that HQ did not store.
**Revisit if:** HQ starts sending that shape on purpose.

## Q: After a read, keep the picked file in the box?
**Decision taken:** The box is cleared after each Upload, so the fixed file is picked afresh (a browser fires no change for the same path still in the box and would send the stale handle). The report stays until the next pick.
**Why:** The all-or-none loop is "fix every one and upload the whole file again".
**Revisit if:** The owner prefers the name to stay visible.

## Q: "Open the campaign upload" links to `/campaigns/uploads/:dealCode`, which has no route until 532
**Decision taken:** Kept as the ticket says ("a plain link until 532 lands"). Today it falls to the router's catch-all (home).
**Why:** Decided in the ticket; 532 declares the route as a static leaf beside `campaigns/:id`.
**Revisit if:** 532 does not land in this wave.

## Q: CONTEXT.md vocabulary
**Decision taken:** Not edited. oms-react's CONTEXT.md has no "campaign upload" / "deal" entry (it lists "deal" only as an Avoid word under Bonus buy); the binding glossary for this wave is BackOffice's CONTEXT.md.
**Why:** Vocabulary changes go through /domain-modeling, not a build slice.
**Revisit if:** The owner wants the rule-engine terms mirrored into oms-react's glossary.

## Q: Standards review judgement calls not acted on
**Decision taken:** Left as they are: the side sheet copied from the house pattern (a fourth copy — a core `SideSheet` is a separate refactor), two identical grid col defs differing only in their generic, and the 532 types (`RuleUploadSummary`, `Detail`, `Activation`, bodies) in the model, which the ticket asked for.
**Why:** Out of this slice, or asked for by the ticket.
**Revisit if:** A hardening ticket graduates the side sheet to `core/ui`.
