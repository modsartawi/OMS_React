# HITL — ticket 475 (spec 470, recent replays + ReceiptReplay audit label)

## Contract gap
- **`GET ActionSync/Replays` paging shape.** Spec 470 writes the answer as `{ rows: [...], total }` and the query as `?page=` only. Per the runner's ruling the client follows the console's `Paged<T>` convention: it reads `{ items, total, page, pageSize }` and sends `page` + `pageSize=50`. The BackOffice spec must either answer in `Paged<T>` (and honour `pageSize`) or the client must change. Answered as `{ rows, total }`, the list would read as empty. **Resolved 2026-10-12:** the owner kept `Paged<T>`; spec 470's contract line was amended to match.
- **Row identity.** The row has no id of its own. The client keys rows by `transactionId`, on the assumption that each replay mints a fresh one, as spec 470's server notes say.

## Q: What happens to the list's page after a push?
**Decision taken:** It goes back to page 1, which is re-read (`REPLAYS_KEY` is invalidated) and shows the new replay on top.
**Why:** The ticket says the list refreshes after a push. Re-reading page 2 would hide the replay the tester just made (/code-review finding).
**Revisit if:** testers browsing older replays want to stay on their page.

## Q: How does the list page?
**Decision taken:** It copies the audit feed's pattern: `TabGrid` + `GridPager` at 50, the same clamp back to the last page when an inner page empties, and the console's "This page is empty. Go back a page." words.
**Why:** It matches its siblings (AuditFeed, MirrorTab, PendingPage).
**Revisit if:** a shared paged-feed helper is extracted. /standards-review flagged the duplication as a judgement call, and it was left alone in this slice.

## Q: Which columns?
**Decision taken:** Replayed at · By · Source store · Source receipt · Store · Register · New receipt. `transactionId` is the row id only and is not drawn.
**Why:** These are the ticket's three column groups, read literally.
**Revisit if:** the owner wants the new transaction id visible.

## Q: Did any existing drive assertion change?
**Decision taken:** No. The replay drive gained section 9 and a `ActionSync/Replays` stub (with no rows by default). The controls drive gained section 11 and a `REPLAY_AUDIT` fixture used only there.
**Why:** —
**Revisit if:** —
