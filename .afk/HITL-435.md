# HITL log — ticket 435 (Failed donor transfers, re-run)

## Q: Which failures read as "it may still be running"?
**Decision taken:** Every failure that is not a business refusal or a 401: network, a 504 or any other 5xx with no error code, an unknown status, or a thrown non-`ApiError`. None of them ever says "failed".
**Why:** WPF's `ReRun` catches every exception as "did not answer (it may still be running)". A 500 that arrived mid-run cannot prove the job never posted.
**Revisit if:** BO-4 promises that a 5xx means the run never started. A plain 500 could then say "could not start".

## Q: After a lost answer, should the line's Re-run be held back for a while?
**Decision taken:** No cooldown. When the run settles the list reloads, and the line is re-runnable again only if the server still reports it FAILED. The confirm modal stands in front of every run. /code-review flagged that a user could re-run while the first run is still going.
**Why:** WPF has no cooldown, and inventing one is a UX ruling. The server should refuse a job that is not FAILED (`NOT_RERUNNABLE`), and the outbox keeps the job's status, so a run in progress should not read FAILED.
**Revisit if:** BO-4's outbox keeps a running job in status F until it finishes. A second run could then post twice. The fix then is a server-side lock, or a client hold until the next manual Reload.

## Q: The no-answer toast does not append the transport error (WPF appended `ex.Message`)
**Decision taken:** It is left off. The toast says the run did not answer, may still be running, and to reload in a minute.
**Why:** The `ApiError` message for these kinds is generic app text ("network error", "server error"). It adds nothing, and it could read as "failed".
**Revisit if:** Support wants the transport detail in the toast.

## Q: Extra copy the ticket did not list
**Decision taken:** Three additions:
- The modal has a second line, "This posts the transfer's stock in DRS."
- A `success:false` with no error says "… did not finish." with no colon or gap.
- A refusal toast's title is "… was not re-run", with the server's message as the description. A refusal with no message gets "The server gave no reason." and never shows the raw code.
**Why:** Re-running moves stock, so the confirm should say so. A sentence ending in a dangling colon reads like a bug.
**Revisit if:** The owner wants the modal bare, or the WPF wording verbatim.

## Q: Where the Re-run sits
**Decision taken:** It is the first grid column ("Re-run"), as in WPF, with a button only on a line whose `canReRun` holds. Without the grant the column is not drawn at all.
**Why:** WPF parity. "Without the grant there is no action at all" also rules out an empty column.
**Revisit if:** The owner wants the action inside the Action column.

## Q: Drive port
**Decision taken:** The drive ran on port 5235 via `DRIVE_PORT`. Port 5199 was held by a server I did not start (the main checkout's, as in 434), so I left it running. I killed the vite server I started on 5235 after the run.
**Why:** I must not kill a server the human left running.
**Revisit if:** —

## Note: BO-4 is not filed
The run door is stubbed exactly as spec 430 D5 says: `POST SdDocumentWeb/FailedDonorTransfers/{outboxId}/Run` → `{ success, error }`, refusal `NOT_RERUNNABLE`. `OutboxRunResult` is WPF's `SdOutboxManualRunResult` in camelCase. The client posts `{}` as the body, because the outbox ID in the path is the whole request.
