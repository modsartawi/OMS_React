---
type: spec
status: ready
---

# 147 — UA users at scale: the activation counter, paging, and export (spec)

Synthesized from wayfinder map [139](139-ua-users-scale-and-export.md) (tickets 140–146, all
resolved). Every "why" below traces to a ticket; this document is the buildable statement, not the
reasoning — zoom the linked ticket when a decision looks arbitrary.

## Problem Statement

The `admin/ua-users` screen was built to answer *"what is wrong with this one person's login?"* and
it does that well. Ayed is now using it for a different job — running the SAP-to-Ua cutover across
roughly **6,000 identities** — and at that job the screen has three walls:

1. **No one can tell how far the cutover has got.** Six report cards count problems (not seeded, no
   usable phone, awaiting activation, must change, disabled) and total population. None counts the
   thing the project is actually measured on: how many people have *finished* activating. The number
   exists nowhere — it can't even be derived by subtracting the cards from each other, because they
   count over three different universes.
2. **Every list stops at 50 rows, and there is no 51st.** Search results and card worklists are both
   capped server-side; the screen shows the first 50 and a note saying more exist. For a card like
   *All people* — 6,000 rows — the remaining 5,950 are simply unreachable through the UI. The only
   coping strategy is to keep narrowing the search term until fewer than 50 people match, which is
   guesswork when you don't already know who you're looking for.
3. **Nothing can leave the screen.** Reconciling against an SAP extract, mailing a branch manager the
   list of their staff who haven't activated, or tracking the cutover week-over-week all mean getting
   the data into Excel — and today that means reading 50 rows off a browser and retyping them.

The three compound: you can't measure progress, you can't see past the first page of the people who
are blocking it, and you can't take the list anywhere to chase them.

## Solution

Three additions to the screen that already exists — no new screens, no new navigation, no rebuild of
the grid.

- **A seventh report card, "Activation done"**, counting people who have completed activation. It
  sits fifth in the row, next to *Awaiting activation*, so the pair reads as two ends of one journey:
  how many still need chasing, how many are finished. Clicking it lists them, like every other card.
- **A pager under the grid.** Fixed 50-row pages walked with Previous / Next and a "Page 3 of 120"
  readout, appearing only when there is more than one page. The 50-row wall stops being a wall and
  becomes a page boundary; the "refine your search to narrow it down" note retires, because refining
  is no longer the only way through.
- **An Export CSV button** over the *current query's full match set* — not the page you happen to be
  looking at. Any card, any search. Above 500 rows it asks first (naming the row count and the rough
  wait) because walking 6,000 people takes about 45 seconds; below that it just downloads. The file
  opens cleanly in Excel with employee IDs and mobile numbers intact rather than mangled into
  scientific notation.

Two of the three ship against the server exactly as it stands today. Only the seventh card needs
anything from SIS.Api — one new count and one new worklist case.

## User Stories

**The seventh card**

1. As a cutover owner, I want a card counting the people who have **completed activation**, so that I can state the project's progress as a number instead of inferring it.
2. As a cutover owner, I want that card to sit beside *Awaiting activation*, so that "done" and "still to do" read as one pair rather than two unrelated statistics.
3. As a cutover owner, I want clicking the card to list exactly the people it counted, so that the number and the worklist can never disagree.
4. As a cutover owner, I want the card to carry **no alarm colour**, so that the one card on the row whose rows need nothing done doesn't read as a problem queue.
5. As a back-office user on a build where the server hasn't shipped the count yet, I want the card to be **absent entirely**, so that I never see a confident `0` that is really "unknown" and go tell someone the cutover hasn't started.
6. As a back-office user, I want the card row to look deliberate at both six and seven cards, so that the interim state isn't visibly broken furniture.
7. As a domain reader, I want *Completed activation* to mean one written-down thing, so that the card, the worklist, and any future report agree on who counts.
8. As a cutover owner, I want an admin password reset to be understood as moving someone **back** out of the count, so that a dip in the number is read as a reset rather than a bug.

**Paging**

9. As a back-office user, I want to reach the 51st matching person, so that the list stops hiding people from me.
10. As a back-office user, I want Previous / Next and a "Page N of M" readout under the grid, so that I know both where I am and how much is left.
11. As a back-office user, I want the pager to appear only when there is more than one page, so that a four-row result doesn't grow controls it doesn't need.
12. As a back-office user, I want a new search or a different card to put me back on page 1, so that I never land on page 7 of a list I just opened.
13. As a back-office user, I want the page I'm on to survive selecting a person, so that inspecting someone doesn't cost me my place in a methodical walk.
14. As a back-office user, I want the page I'm on to survive an action I take on that person (reset password, disable, clear TOTP), so that working down a worklist doesn't restart it after every fix.
15. As a back-office user who empties the last page by acting on its final row, I want to be moved to the new last page rather than shown an empty grid, so that the screen never looks broken by my own success.
16. As a back-office user, I want paging back and forth to feel instant on pages I've already seen, so that a walk through a worklist isn't a stutter of spinners.
17. As a back-office user, I want the grid to dim rather than blank while the next page loads, so that a spinner means "first load" and nothing else.
18. As a back-office user, I want the "refine your search to narrow it down" note gone once paging exists, so that the screen stops advising a workaround for a wall that isn't there.
19. As a back-office user, I want the match count in the grid header to state the **true total**, so that a 6,000-row card doesn't report "50".

**Export**

20. As a cutover owner, I want to export the current list to CSV, so that I can reconcile it against an SAP extract in Excel.
21. As a branch coordinator, I want the export to cover the **whole match set**, not the visible page, so that one click gives me all 400 people with no usable phone rather than the first 50.
22. As a cutover owner, I want to export *All people* too, so that the one list I most need for reconciliation isn't the one list that's forbidden.
23. As a back-office user exporting more than 500 rows, I want to be told the row count and roughly how long it will take before it starts, so that a 45-second wait is something I chose rather than something that happened to me.
24. As a back-office user exporting a narrowed card, I want the file to just download, so that routine exports don't grow a dialog to dismiss.
25. As a back-office user, I want a progress indication while a long export runs, so that I can tell it's working rather than hung.
26. As a back-office user, I want to be able to cancel a long export, so that a click I regret doesn't hold the screen for a minute.
27. As a back-office user who cancels, I want **no file at all**, so that a half-list never lands in my downloads folder looking exactly like a whole one.
28. As a back-office user whose export hits a server error partway, I want **no file at all** plus a message saying what went wrong, so that a truncated file never gets mistaken for the truth.
29. As a cutover owner, I want the export never to silently stop early, so that "who is missing from this file" stays a question about *people*, not about *the file*.
30. As a back-office user, I want the export not to disturb the grid I'm looking at, so that exporting isn't also a navigation event.

**The file itself**

31. As an Excel user, I want employee IDs to survive the round trip, so that a leading zero isn't eaten and a long numeric ID isn't turned into `1.23457E+11`.
32. As an Excel user, I want mobile numbers to arrive as text, so that the column is dialable rather than arithmetic.
33. As an Excel user, I want the file to open in columns on a double-click, so that I don't have to run the import wizard to make it readable — including on a machine whose regional list separator isn't a comma.
34. As an Excel user, I want Arabic names to render correctly, so that the export isn't a wall of question marks.
35. As an analyst, I want one column per fact — including the seeded / enabled / TOTP details the on-screen Status pill hides behind its precedence chain — so that I can filter on the thing I care about rather than reverse-engineer it.
36. As an analyst, I want the delivery channel split into *where codes go* and *whether that can reach them*, so that "on email" and "on email with no address" are distinguishable in a filter.
37. As an analyst, I want every classification spelled as the **same words the screen shows**, so that the file reconciles against the screen without a decoder ring.
38. As an analyst, I want a never-signed-in person to have an **empty** last-login cell rather than the word "Never", so that the column still sorts as dates.
39. As an analyst, I want timestamps exactly as the server stores them, so that no row is silently shifted by a timezone conversion.
40. As a back-office user, I want the downloaded filename to name the scope and the date, so that three exports in one week don't collide in my downloads folder.
41. As a security-minded reader, I want a free-text field beginning with `=` or `+` to be inert when opened, so that a display name can't execute as a formula.

**Access and record-keeping**

42. As an administrator, I want the export to require no permission beyond the screen itself, so that the button isn't a fiction that hides a capability anyone with the screen already has.
43. As a security reviewer, I want the decision *not* to gate or audit the export written down with its reasoning and its reversal trigger, so that I find a decision rather than an oversight.
44. As a platform owner, I want the one server change this needs stated as a contract, so that SIS.Api can implement it without reading the React code.

## Implementation Decisions

### Scope of change

All client work lands in the existing `admin` area's `ua-admin` feature and its `ua-admin` i18n
namespace. No new route, no new menu item, no new access probe, no change to `core/api.ts`. The
grid stays the plain HTML table it is today — AG Grid is explicitly not in play (map 139).

### The seventh card

- **Predicate (ticket [141](141-completed-activation-predicate.md)):** a person has *completed
  activation* when they are **legacy-backed ∧ not a shared account ∧ `credentialState == 'active'`**.
  Deliberately **no `isActive` clause** (a leaver who activated still counts — the card is an
  odometer for how far the cutover got, not a headcount of current staff) and **no phone clause**
  (`active` already proves someone was reached). `temporary-must-change` does **not** count; a first
  sign-in is **not** required.
- This is a **new predicate, not the negation of `awaitingActivation`.** The two do not partition the
  estate. The row of cards **already doesn't sum** (three different universes — `mustChange` alone
  skips the legacy-backed join and the shared-account exclusion), and this card does not fix that and
  is not expected to. Do not add a "totals reconcile" check anywhere.
- **Server-only.** The count cannot be derived client-side from the six existing numbers. Until the
  server ships it (see *Server contract addendum*), the wire field is **absent**, and an absent field
  means **the card is not rendered** — never `0`, never a placeholder.
- **Label and placement (ticket [142](142-seventh-card-label-and-placement.md)):** on-screen label
  **"Activation done"**, key `cards.completedActivation`, at **position 5**, immediately after
  *Awaiting activation*. The domain term stays *Completed activation* in `CONTEXT.md` and on the
  wire; only the label is shortened. **"Disabled" does not move and is not renamed** — it is the same
  word as the status pill, the Status column, and the Disable/Re-enable actions. The card carries
  **no tone class**: on this row colour means *there is work here*, and this is the one card whose
  rows need nothing done. The asymmetry with its accented neighbour is deliberate.
- **Card row layout:** the row stops being a fixed six-slot grid. It becomes an auto-fitting track
  (`repeat(auto-fit, minmax(8rem, 1fr))` in spirit — the point is *fits N*, not the exact minimum),
  because the card is conditionally present and the row must look right at **both 6 and 7**.
- The card list currently lives as an inline array in the page. It moves to its own module so the
  "which cards are visible, given these counts" question becomes a pure function (see *Testing*).

### The pager

From ticket [143](143-pager-shape.md):

- **Fixed 50-row page. No page-size chooser.** `MaxSearchRows` clamps `take` *downward* server-side,
  so the only selectable range would be 25/50 — not worth a control — and raising the clamp is the
  same shared lever the export explicitly declines to touch.
- **Previous / Next + "Page N of M"** in a grid footer. **No numbered pages**: *All people* is 120
  pages, and nobody navigates to page 87 deliberately.
- The footer renders **only when `totalMatches > 50`**.
- **`isCapped` stops being displayed** and becomes the **Next-button enablement flag**. The
  `grid.capped` key is deleted; `search.hint` and `grid.emptyHint` are reworded to stop advising
  narrowing as the way past the wall.
- **Latent bug fixed in passing:** the grid header's match count currently reads `rows.length`; it
  must read `totalMatches`.
- **The page number becomes a field of the query object**, not separate state. Consequences, all
  free: a new search or card switch resets to page 1 *by construction*; each page is its own cache
  entry; nothing needs an explicit "reset the pager" call anywhere.
- **Selection survives paging.** This is the do-nothing implementation — the detail pane fetches by
  employee id and never reads the grid row — and it is recorded here so nobody "fixes" it by
  clearing selection on page change.
- **A mutation holds the page**, with one guard: if the refetch leaves the current page empty and the
  page is above 1, clamp to `ceil(totalMatches / 50)`.
- Use `placeholderData: keepPreviousData` plus dim-and-disable while fetching, so the spinner means
  *first load* again.
- **Accepted, not engineered around:** a membership change shifts rows up by one, so a person can
  slide between pages during a methodical walk. This is a known property of offset paging over live
  data, not a defect to solve.
- **No server change.**

### Export scope and cost

From ticket [144](144-export-scope-and-cost.md):

- **One always-enabled button** over the **current query's full match set**, walked from `skip: 0` —
  it ignores the page you're on.
- **Everything is exportable, including `all`, but past 500 rows you have to mean it.** Above
  `totalMatches > 500`, a confirm names the row count and the rough wait; at or below, the file just
  downloads. The threshold protects **the user's expectation, not the browser or the server**: under
  ~4 seconds a click feels like it worked, past that it feels like it hung. `phoneGap` (~400) lands
  just under deliberately, so in practice only *All people* raises the dialog.
- The walk is **the pager's own call in a loop, at 50** — zero new contract surface. The
  `MaxSearchRows` lever is **declined and recorded as declined**: it is a shared constant (raising it
  deletes the interactive-search guard and breaks the fixed page), and the saving is HTTP round trips
  (~3–4×), not database work.
- **Progress is a cancellable toast**, not a blocking modal. The walk **never writes to the mounted
  query's cache** — exporting must not navigate or disturb the grid.
- **The governing rule, both directions: cancel or any `ApiError` ⇒ no file at all.** A partial CSV
  is indistinguishable from a complete one once it's in Excel, and this file's whole use is spotting
  who is *missing*. Errors surface through `apiErrorMessage`; 401 remains `handle401`'s business and
  is not caught here.
- **Terminate on `isCapped == false`**, with a **200-page runaway guard**, and **dedupe by
  `employeeId`** — a 45-second walk can be shifted mid-flight by a concurrent SAP insert.

### The CSV file

From ticket [145](145-csv-shape-and-excel-fidelity.md):

- **The file is the wire row unpacked, not the grid screenshotted:** 13 columns — one per grid-row
  field, plus the derived Status. The on-screen channel pill is **split back into two columns**
  (*Codes via* + *Reachable*), and the seeded / enabled / TOTP facts are kept as their own columns
  even though the Status precedence chain hides them on screen.
- **Every classification is the label, through the same `t()` key the screen uses** — never the raw
  code. The file therefore reconciles against the screen by construction. The accepted price:
  **the export is localised, headers included.**
- **Excel fidelity is three guards in the writer:**
  1. `="…"` formula-text wrapping on `employeeId` and `phone` — plain quoting does *not* preserve a
     leading zero;
  2. a `'` prefix on any free text starting `=`, `+`, `-`, or `@`;
  3. **BOM + a leading `sep=,` line + CRLF** — the `sep=` line because Excel's double-click path uses
     the OS list separator (`;` in Arabic locales), at the accepted cost of one junk first row in
     non-Excel tools.
- `lastLoginAt` uses the existing stamp formatter's `YYYY-MM-DD HH:mm` with **no `new Date()`**
  anywhere near it, and `null` is an **empty cell, not "Never"** — a word would make the column text
  and kill sorting.
- **Filename `ua-users-{scope}-{YYYY-MM-DD}.csv`**, where scope is the card **code** (labels don't
  survive sanitising), date only, no time.
- Lands as a **pure module** with no DOM and no network — the string is built, then handed to the
  download. The screen and the file **share** the existing status/reachability/credential/stamp
  helpers rather than re-deriving any of them.

### Access and audit

From ticket [146](146-export-gate-and-audit.md):

- **The export button carries no permission check of its own.** It renders whenever the screen
  renders — i.e. behind the existing screen-open access probe that already guards the route and the
  menu item. **No `canExport` field, no new probe, nothing new in the authz-admin feature.**
- **No new grant.** There is no export endpoint to enforce at (the export *is* the pager), so a gate
  could only decide whether to draw the button while the capability stayed open — and the one screen
  grant already carries set-password, deactivate, clear-TOTP and revoke-session, so fencing the
  mildest act on the screen would invert least privilege. The separation already exists a level up:
  the grant sits on a standalone, deliberately-assigned role.
- **No audit row.** No read is audited anywhere on this surface today, and a client-declared "I am
  exporting" ping is self-reported — the documented x-api-key twin of these endpoints is an
  un-instrumented path to the same data.
- **Do not describe the >500 confirm as a control.** It is a wait-time device: dismissible, and
  absent on every narrowed card.

### Server contract addendum

**One required change**, filed as BackOffice ticket **805**:

- Add `completedActivation` to the report-counts result, populated by the predicate above.
- Add the matching `completedActivation` case to the card worklist, so
  `ReportCards/completedActivation` returns the same people the count counted.
- **Name the wire field exactly `completedActivation`** — do *not* repeat the existing
  `mustChange` → `mustChangePassword` card-key/field asymmetry.

**Two deferred notes, no action now:**

- If the export ever proves too slow, add a **separate export cap** — do not raise `MaxSearchRows`,
  which is a shared interactive-search guard.
- If the export ever must be gated or audited, the move is a **server-side export endpoint** that
  streams the full match set in one call, audits it (new action code, actor from the session, scope
  code as the target — that column is already polymorphic), and carries its own grant. That endpoint
  would replace the client walk wholesale, so it is a **re-decision of this spec's export design**,
  not an addition to it. Never a client-side `canExport` flag, which would enforce nothing.

Until 805 ships, the client is fully functional minus the seventh card. **The pager and the export
do not depend on it** and must not be sequenced behind it.

### i18n

New keys in the `ua-admin` namespace: the card label, the pager controls and readout, the export
button, the confirm dialog's title/body/actions, the progress and outcome toasts, and **one key per
CSV column header**. Deleted: `grid.capped`. Reworded: `search.hint`, `grid.emptyHint`. Every CSV
cell value that is a classification resolves through an existing `t()` key — no new label vocabulary
is invented for the file.

## Testing Decisions

A good test here asserts **observable behaviour at a module's edge** — the string that comes out of
the writer, the pages a walk requests, the label a card row exposes — and never how the module got
there. No test asserts on internal state, call ordering, or a React implementation detail.

**Tier 1 — pure, in-memory (`vitest`, the existing runner, `environment: node`).** This is where
essentially all the regression risk lives, and all four modules are new, so they can be shaped for
testability from the start:

1. **The CSV writer.** Input: an array of grid rows plus a label resolver. Output: a string. Covers
   column count and order, the `="…"` wrapping on employee id and phone, the `'` prefix on
   formula-leading free text, BOM + `sep=,` + CRLF, quote/comma/newline escaping inside a display
   name, empty cell for a null last-login, no timezone drift on a stamp, and the filename builder.
   The single highest-value suite in this spec — every one of these fails *silently*, showing up only
   as a wrong number in someone's spreadsheet weeks later.
2. **The export walk.** Written to take a `fetchPage(skip)` callback and a cancellation signal, so it
   is driven in-memory with a fake fetcher — no network, no DOM. Covers: walks from 0 in steps of 50;
   stops when `isCapped` goes false; the 200-page runaway guard fires; duplicate `employeeId`s across
   pages are deduped; **cancel mid-walk yields no rows** and **a throwing page yields no rows** (the
   "no partial file" rule, asserted as *the walk refuses to return a result*, not as "the file wasn't
   written").
3. **Pager arithmetic.** Page count from `totalMatches`; whether the footer shows at all; Next
   disabled on the last page; Previous disabled on page 1; and the clamp that moves an emptied page
   above 1 down to the new last page.
4. **Card visibility.** Given a counts object, which cards render, in what order — proving the
   seventh appears when the field is present, is absent (not zero) when it isn't, and that *Disabled*
   stays put in both arrangements.

**Tier 2 — flow (Playwright drive).** One new manual-run drive alongside the existing ones, prior art
`tools/ua-channel-drive.mjs` (and `tools/screen1-smoke.mjs` for shape). It covers what the pure
modules cannot: the footer appearing only past 50 rows, Previous/Next actually moving the grid,
selection surviving a page change, the >500 confirm appearing and being dismissible, and a file
landing on download. Run against a stubbed envelope where SIS.Api is unavailable — the same approach
tickets 051/052 used.

**Not doing: React Testing Library.** Spec 083's ruling holds and this feature is an unusually good
argument for it — the four modules above carry the risk and are all pure, while the DOM addition is a
footer with two buttons and a toast. Bootstrapping jsdom + RTL stays the hardening ticket's to do,
and this spec does not claim it.

**Always:** `npm run typecheck` and `npm run lint` (import boundaries, contrast, colour literals)
green before any ticket is called done.

## Out of Scope

- **Implementing the SIS.Api change.** This spec states the contract; the C# is BackOffice 805.
- **Paging the audit tab.** It keeps its own local 50-row read. Ruled out of scope at map close: it
  is a fourth ask, and a 50-deep per-person history is a different (and unevidenced) case from a
  6,000-row roster.
- **The 50-row cap on any screen other than `admin/ua-users`** — including the sessions list, which
  is another screen entirely.
- **Replacing the plain HTML table with AG Grid.** Paging is added to the table that exists.
- **A server-generated export file**, a server export endpoint, an export grant, or export auditing —
  all four are the same deferred move, triggered together or not at all.
- **Raising `MaxSearchRows`.** Declined with reasons; a future fix is a separate export cap.
- **Making the report cards sum.** They already don't, for structural reasons predating this work.
- **Localising the export to a fixed language.** The file follows the UI locale by design.

## Further Notes

- **Build order.** Three independent chains. The pager is the spine (it is also what the export walks
  with), so: pager → export walk + CSV writer → the seventh card. The card is the only piece gated on
  BackOffice 805 and should be sliced so the rest can ship without it.
- **The interim state is a real state, not a temporary hack.** Between this shipping and 805
  shipping, the screen shows six cards and an auto-fitting row. That must look finished, because it
  may be what production sees for a while.
- **`CONTEXT.md` already carries the vocabulary** — *Completed activation* and *Seeded* were added
  when ticket 141 resolved. Use those words in code, tickets, and UI copy.
- **The caveat worth telling Ayed once:** an admin password reset moves someone back out of the
  Activation-done count, so the number is monotonic *except for resets*. A dip is a reset, not a bug.
- **Reasoning lives in the tickets.** [140](140-uaadminweb-contract-as-built.md) (what the contract
  already gives), [141](141-completed-activation-predicate.md) (the predicate),
  [142](142-seventh-card-label-and-placement.md) (label and placement),
  [143](143-pager-shape.md) (the pager), [144](144-export-scope-and-cost.md) (scope and cost),
  [145](145-csv-shape-and-excel-fidelity.md) (the file), [146](146-export-gate-and-audit.md) (gate
  and audit). Read the ticket before reopening a decision.
