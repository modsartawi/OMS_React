---
type: wayfinder-ticket
wayfinder: grilling
map: 139
status: done
blocked-by: 143
---

# 144 — How much the export exports, and what that costs

## Question

The ruling at charting was **client-side CSV over the full match set**, not a server-generated file.
That ruling has a bill attached, and this ticket makes the bill explicit before it surprises anyone.

At the page size 143 settles, exporting the full match set means the browser walks every page
sequentially. With `allPeople` in the thousands (140 gives the real magnitude) that is tens to
hundreds of round trips against a gated admin endpoint.

- **Is the "All people" card exportable at all**, or does export only make sense on a narrowed
  query — a search or a smaller card? If there is a limit, what happens when the user exceeds it:
  the button disables with a "narrow your search" hint, or a confirm appears that says how long it
  will take?
- **What is the ceiling number?** Pick one, and say what it is protecting — the browser, the server,
  or the user's patience.
- **What does the user see while it runs?** A progress indicator with page counts, a blocking modal,
  a toast? Can they cancel, and if they cancel mid-walk, is a partial file wrong to hand them?
- **Failure mid-walk.** Page 7 of 40 returns a business error or a 401. Retry, abandon, or deliver a
  partial file with a warning row? The `api-envelope` rule says the `ApiError` must not be flattened
  into a generic string — decide what the user is actually told.
- **The escape hatch.** If the honest answer turns out to be "this needs a server endpoint", say so
  here and write it into the contract addendum rather than shipping something that times out. That
  would revise a charter-time ruling, so it needs to be argued, not assumed.

## Answer

**Everything is exportable, but past 500 rows you have to mean it — and the walk is all-or-nothing.**
The charter-time ruling survives intact: client-side CSV over the full match set, at the pager's own
50-row page, with **no server change**.

### 1. Scope — every query is exportable, including `all`

One export button, **always enabled** when `totalMatches > 0`. Above the ceiling a confirm appears
naming the cost; below it the file just downloads.

The rejected alternative was disabling export above a ceiling and telling the user to narrow. It is
the tidier engineering answer and it fails the actual ask: Ayed wants a spreadsheet of the staff, and
"the one card that holds everybody is the one card you can't export" is a rule users route around by
pasting the screen into Excel. The opposite extreme — always-silent — is a 45-second unexplained
freeze the first time it is clicked, which reads as a broken button. The confirm turns the cost into
information the user consented to, and keeps the ceiling a **speed bump, not a wall** — which matters
because the number below is a judgement about latency nobody has measured.

**What "the match set" is:** the `Query` in effect at click time — the card, or the search term —
walked from `skip: 0`, **ignoring the page the user is on**. Exporting page 3 alone is not a case.

### 2. The ceiling — 500 rows, protecting the user's expectation

| Threshold | Pages | Silent worst case |
|---|---|---|
| 250 | 5 | 1–2 s |
| **500** | **10** | **2–4 s** |
| 1,000 | 20 | 4–8 s |
| 2,000 | 40 | 8–16 s |

`totalMatches > 500` ⇒ confirm; otherwise straight through.

It protects **neither the browser nor the server.** 6,000 rows of seven short strings is well under a
megabyte — `Blob` + `createObjectURL` will not blink. The server sees ~720 cheap indexed queries
spread over a minute from a grant-gated screen one person uses. What actually breaks is the user's
model of a download button: **under ~4 seconds a click feels like it worked; past that it feels like
it hung.** 500 is the largest round number that stays inside that window on a bad-latency day.

Deliberate consequence: `phoneGap` (~400, `UaAdminService.cs:196`) lands *just* under, so the everyday
remediation worklist exports with no dialog — and the dialog stays rare enough that nobody learns to
dismiss it reflexively. In practice `all` is close to the only query that triggers it.

### 3. The escape hatch — declined, and recorded as declined

[143](143-pager-shape.md) left the `MaxSearchRows` lever here. **Not pulled.** Three reasons:

1. **It is not a knob, it is a shared const.** `MaxSearchRows = 50` clamps *every* caller — search
   box, worklists, audit. Raising it also raises the interactive search, deleting the "a broad term
   must stay cheap and must push the admin to sharpen it" guard the const exists for, and breaking
   143's fixed 50-row page. The real change is a **new, separate export cap** plus a per-path clamp
   in `UaAdminService` — a genuine server change, not a one-liner.
2. **The saving is HTTP, not database.** Six queries per page is per *page*, but the page query is a
   `LIKE '%x%'` scan regardless of size and the three batched cross-table reads scale with row count.
   12 pages of 500 is ~72 queries instead of ~720 — each roughly ten times heavier. The honest win is
   round-trip overhead: perhaps 3–4× wall-clock, not 10×.
3. **Zero new contract surface.** Export becomes *literally the pager's own call in a loop* — same
   `search`/`worklist` function, same envelope, same types. This map's addendum stays down to the one
   item [141](141-completed-activation-predicate.md) genuinely requires.

We already paid for the time with the confirm; spending a server change to speed up a rare, consented
operation is optimising the thing the user agreed to wait for. **Written into the addendum as a
deferred escape hatch, not a request:** *if export proves too slow in practice, add a separate export
row cap — do not raise `MaxSearchRows`.*

### 4. While it runs — a progress toast, cancellable, and cancel yields no file

- **No blocking modal.** The confirm is the only modal, and it is gone before the walk starts.
- A **sonner loading toast** carrying page progress — *"Exporting… page 3 of 120"* — updated per
  page, dismissed and replaced by a success toast naming the row count on completion.
- The **export button is disabled** for the duration (with the pager still usable — the walk does not
  touch the mounted query or its cache; it calls `uaAdminApi` directly and writes nothing to
  TanStack Query).
- The toast carries a **Cancel** action. **Cancelling produces no file.**

That last rule is the one that matters and it is the same rule as §5: **a partial CSV is
indistinguishable from a complete one once it is in Excel.** This file's whole use is spotting who is
missing — a short file does not look broken, it looks like good news.

### 5. Failure mid-walk — abandon, no file, the real message

Any `ApiError` on any page: **stop, discard everything collected, show an error toast built with
`apiErrorMessage(err, fallback)`** — the envelope's own `message` for a business refusal, never
flattened into a generic string (`.claude/rules/api-envelope.md`). No retry, no backoff, no
partial-file-with-a-warning-row (the warning row gets deleted and the file gets trusted anyway).

**401 is not handled here at all** — `handle401` in `src/core/api.ts` already clears the session,
toasts once, and redirects; the walk dies with the screen, which is correct.

### 6. Two mechanical rulings the walk needs

- **Termination:** loop while `isCapped === true` (143 established it as the `hasNextPage` flag),
  with a hard stop at **200 pages** as a runaway guard — 10,000 rows, comfortably above the ~6,000
  estate, and it can only fire on a server bug.
- **Dedupe by `employeeId`** into a `Set` as pages arrive. Ordering is stable by `employeeId`, but a
  concurrent SAP sync insert during a 45-second walk shifts rows across the page boundary — 140
  records that off-by-one. Three lines, and it prevents a duplicate row in the file.

### Consequences for the rest of the map

- **Nothing required for the contract addendum** — only the deferred export-cap note from §3.
- **No revision to the charter-time ruling.** Client-side CSV over the full match set stands.
- **[145](145-csv-shape-and-excel-fidelity.md) is unblocked** and inherits: the file is always the
  complete match set or no file at all, so it never needs a "partial export" marker, a warning row,
  or a truncation note among its columns.
- **[146](146-export-gate-and-audit.md) inherits a sharper question**: this ticket has just made the
  full 6,000-person roster downloadable in one consented click, which is exactly the act 146 asks
  whether to gate or record.
