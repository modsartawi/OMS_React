---
status: open
spec: 261
blocked-by: 265
---

# 266 — The screen calls the real door

## What to build

The joining event. Everything in 262–265 is proven against stubs; this ticket points the screen at a
**live SIS.Api and a live render host** and downloads a real PDF of a real invoice.

⚠ **This ticket is excluded from any AFK run.** It needs two processes a session cannot reliably stand
up — see Prerequisites. A screen built entirely on fixtures can be perfect against a door that does not
open, which is exactly why this is a ticket rather than a Proof checkbox on 265.

### Prerequisites — the two processes

The rail is **two** hops, and both must be up. Neither is IIS, so this runs on an ordinary dev box.

1. **The render host** — `BackOffice.exe renderhost`, an `HttpListener` on `http://127.0.0.1:8971/`.
   It is a **verb of the existing WPF exe**, not a new program, and the only verb that never calls
   `Shutdown()`. ⚠ It takes ~31 s to become ready: session factory, then **12 eager template compiles**
   (3 templates × 4 workers), then a warm-up pre-render, and it **binds the port LAST**. So a
   connection refused in the first half-minute is normal; `GET /health` answering `ok` is the
   readiness signal.
   ⚠ Its database is whatever the `Config.xml` **next to the exe** points at — not an appsetting. A
   stale-schema DB kills it *before the port opens* (`Invalid column name …` out of
   `CompileFamily`), which looks exactly like "it didn't start".
2. **SIS.Api** on `:5111`, with `ReportHost:BaseUrl` / `ApiKey` matching the host's `renderKey`, and
   its `DefaultConnection` pointing at the **same database** as the render host. If the two disagree,
   Search finds an invoice that Download then 404s.

Both were stood up and proven on 2026-08-10. The BackOffice-side assets are at
**`C:\dev\renderhost-test\`**: a Postman collection for the host's three routes, `renderhost.config`,
and `web-leg.ps1`, which walks login → Access → Search → Download and is the fastest way to confirm
the door is open before touching the browser.

### The work

Repoint the feature at the real routes and fix what only a live call can reveal. Expect to find
things: **this is the ticket where the wire meets the model.**

- Confirm the **envelope shape** on all three routes matches the pasted contract types. A body that
  is missing a field the type promises will reach `.length` or `.toFixed` and **throw**, rendering the
  router's error boundary — the type cannot help, because the type is a claim *about the server*.
- Confirm a real **`Content-Disposition`** parses. The live header carries **both** forms
  (`filename="…"; filename*=UTF-8''…`), which 262's parser prefers `filename*` from.
- Confirm the **grant** actually gates: with no holder seeded, `Search`/`Download` answer a **bare
  403** and `Access` answers **200 `screenAllowed: false`**. ⚠ There is **no feature flag** on this
  rail — the unseeded grant *is* the only off-switch. Seeding one `UaUserRole` row flips the whole
  screen on.
- Confirm the **PDF opens in a viewer**. A 200 with a `%PDF-` magic number is not proof it renders;
  ~250 KB and a first-page render is.

### 🔑 The one contract guess this ticket is uniquely placed to settle

Contract §6.2: **`amount` is `RetailTrx.Amount`, and nobody has verified it is the number a person
recognises on a receipt** — gross, net of returns, or the paid figure. This ticket has both the grid
row and the rendered PDF in hand at the same moment, which makes it the cheapest possible proof:
compare the `amount` column against the total printed on the receipt it just downloaded, on a plain
cash sale **and** on a return.

If they differ, that is a **finding to record, not a client fix** — the client must never compute a
displayed total. Write it up here and it becomes a BackOffice ticket against spec 1042.

## Spine reach

The rail's first real user. After this, a back-office user can get an invoice PDF without a till.

## Proof

- [ ] `renderhost` reaches `GET /health` → `ok`, and its `Started`/`Ready` rows are in
      `ReportHostEvent`.
- [ ] `C:\dev\renderhost-test\web-leg.ps1` is green end to end **before** the browser is opened —
      login 200, Access 200, Search 200 with rows, Download 200 `application/pdf`.
- [ ] The screen finds a **real** invoice by its real transaction number, against live SIS.Api.
- [ ] A row downloads a real PDF and **a human opens it in a viewer** and confirms it is that
      invoice's receipt. ⚠ Manual by nature — do not fake or simulate it.
- [ ] `X-Render-Attempt-Id` from the response matches a `Status=Ok` row in `ReportRenderAttempt`
      carrying the right key and `requestedBy`.
- [ ] 🔑 **The `amount` check** (above), on a cash sale and a return, with the result written into this
      ticket either way.
- [ ] The grant proven load-bearing **in both directions**: unseeded → bare 403 on Search + `Access`
      `screenAllowed: false` + no menu group; seeded → the screen works. Remove the holder again
      afterwards if the environment is shared.
- [ ] A genuinely unrenderable row (a **cash clearance**, or an invoice whose store code is
      non-numeric) confirms and then returns a real **422** with a real `attemptId` — the failure
      taxonomy against the real renderer, not a stub.
- [ ] 503 observed for real if convenient: stop the render host and confirm the sentence and the retry
      button. Cheap, and the only way to know SIS.Api's two internal retries are exhausted before the
      browser hears about it.

### Deliberately NOT part of this ticket's proof

⚠ **Do not repoint `tools/invoice-drive.mjs` at live.** Its assertions are about *behaviour on
specific responses* — a 504 sentence, an absent `attemptId`, a confirm on a cash clearance, a
`capReached` warning — and the live estate does not contain most of those cases on demand. A live
drive would assert them **vacuously and go green proving nothing**. This is the same ruling
[259](259-the-screens-call-the-real-door.md) reached for collection; follow it.

## Boundaries

- **No new features.** This ticket repoints and fixes; it does not add a column, a filter or a state.
- **A server-side finding is recorded, never worked around client-side.** If a field is missing,
  mis-scaled or misnamed on the wire, write it up for BackOffice and leave the client honest — do not
  compute a value the server owes.
- **Do not seed a permanent grant holder** on a shared database without saying so here.
- Do not change the render host or SIS.Api from this repo. You may **read** anything in
  `C:\Work\DMSCO\BackOffice`; you may not edit, stage or commit there — it has its own tracker.

## Done when

A real invoice is found and its real PDF downloaded, opened and eyeballed; the grant is proven in both
directions; a 422 comes back from the real renderer with a real `attemptId`; and the `amount` question
is answered in writing.

## Blocked by

[265](265-a-row-downloads-its-receipt.md).

Server side: **nothing** — the whole BackOffice rail is built and 11 of its 12 tickets are done.
⚠ `RetailInvoice/Search` **shipped answering 500 to every request** (an untranslatable LINQ group-join)
and was fixed on 2026-08-10. A stale local SIS.Api build will still 500 — rebuild before blaming the
screen.

## Open questions

Whether `amount` is the number a person recognises (see above). Everything else in the contract is
settled.
