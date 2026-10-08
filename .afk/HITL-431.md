# HITL log — ticket 431 (Donor requests list)

## Q: The donor list door gains a `requestNo` param that spec 430 D3 does not list
**Decision taken:** Sent `requestNo=<no>` (alone, no dates) for `?request=<no>`, stubbed in the drive, recorded in the ticket's Open questions. Spec 430's D3/BO-2 text was NOT edited.
**Why:** The ticket orders it ("add it to the stub contract and say so in Open questions"); the spec is the grilled record.
**Revisit if:** BO-2 is filed — it must carry `requestNo`, or 434's link has no server side.

## Q: What if a server ignores `requestNo`?
**Decision taken:** The client keeps only the rows whose `requestNo` matches when a one-request search was asked (`api.ts`).
**Why:** Without it a server that drops the unknown key answers an unbounded, every-store history under a "Showing request X only" banner.
**Revisit if:** BO-2 ships `requestNo` — the filter is then a no-op and can go. Edge: if the server ignored it AND its limit cut the asked-for row, the screen shows 0 rows with the limited note.

## Q: `store` and `limit` params of D3 — send them?
**Decision taken:** Neither is sent. The ticket's filter bar has only donor store and order store, and no limit control; the server's default limit applies and `limited` reports a cut.
**Why:** Invent nothing beyond the ticket's bar.
**Revisit if:** the owner wants a limit box like Document payments' (default 200) or an "either side" store filter.

## Q: Load on open, or only on Search? (D16 says lists load on Search; story 2 says open on today's)
**Decision taken:** The list loads on open with today's criteria (and with the seeded request), then on Search.
**Why:** Story 2 + the ticket ("defaults to today") and 434's link need a search to happen on arrival; D16 reads as an oversight for this screen.
**Revisit if:** the owner wants an empty grid until Search.

## Q: Where does the attention tone show?
**Decision taken:** Refused/expired: amber (attention) outcome badge. Cancelled: muted badge AND the row's text muted. An OPEN unpicked row shows "Waiting 1h 20m" in a Pick time column; a picked row shows "Picked in 25m" there (minutes to pick, D3).
**Why:** Matches the timeline's tones via `donorOutcome`; a whole-row amber would drown the grid.
**Revisit if:** the owner wants the whole refused row tinted.

## Q: Elapsed-time formatting is now in two features (document's ActivitySpine and donor-requests)
**Decision taken:** Left as two copies (`elapsedText`, `useMinuteClock`) inside each feature; not graduated to `@/core/oms` in 431.
**Why:** Graduating means editing the document feature's spine — outside this slice; 432 (the inspector) is the natural point to graduate it.
**Revisit if:** 432 needs the same formatting a third time — graduate then.

## Note: port 5199 was occupied by a server this session did not start
The drive ran on a vite server started on port 5231 (`DRIVE_PORT=5231`), which was killed afterwards. The process on 5199 was left alone.
