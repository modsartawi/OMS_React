# HITL — ticket 499 (Document Details: the Pick support section)

## Q: Which namespace holds the section's three words (heading, "Stuck" marker, "Open in Pick support")?
**Decision taken:** `pick-support` (`section.heading` / `section.stuck` / `section.openConsole`, EN + AR), not `document`.
**Why:** The wave puts the Pick support words in the `pick-support` namespace, and the shared core panel inside the section already speaks it (the `central-invoice` precedent for a core module drawn by a feature).
**Revisit if:** The owner reads feature-structure's "namespace == feature" strictly. Then move the three keys to `document:`.

## Q: When does the heading carry the stuck marker?
**Decision taken:** Only after the section has been opened and read, and only when the server's verdict is `STUCK`. UNKNOWN, HEALTHY, a refusal, or a failed re-read carry no marker.
**Why:** The ticket says "may carry a stuck marker once the diagnosis is read; nothing is read before the section is opened". The marker reads the server's verdict, and the client derives nothing.
**Revisit if:** The owner wants UNKNOWN (escalate) marked in the heading too.

## Q: Does the page's own Refresh also re-read the diagnosis?
**Decision taken:** Yes, but only once the section has been opened (it invalidates the delivery's diagnosis query, and an unopened section has no active read, so nothing is fetched). The drive proves both halves.
**Why:** /code-review found that without this, an opened section and its Stuck marker go stale after Refresh while the document beside them is fresh.
**Revisit if:** The owner sees this as scope creep. The ticket only asked for the other direction, where a fix refreshes the document.

## Q: The section's delivery number: the route's or the loaded header's?
**Decision taken:** The loaded header's `documentNo`. It is the same number `reload()` re-reads and the console's cache key uses. For a page opened as a delivery it equals the route's number.
**Why:** /code-review flagged a possible cache-key split between the route id and the canonical number.
**Revisit if:** The server ever normalises a delivery number differently in the header than in Pick support.

## Q: Where does the console link's `?key=` builder live?
**Decision taken:** `src/core/pick-support/console-link.ts` (`pickSupportConsoleHref`, `PICK_SUPPORT_PATH`), because two features rely on the console's URL contract. The console's own reader (`resolve-view.ts`) and the router/menu literals were left untouched.
**Why:** Feature-structure says logic shared by two features graduates to core. Re-pointing 496's router and menu literals is outside this slice.
**Revisit if:** A later cleanup wants `router.tsx` / `menu-model.ts` / `resolve-view.ts` to import `PICK_SUPPORT_PATH` too.

## Review notes (not acted on)
- /code-review + spec review: `reload()` returns early while another refresh is in flight, so a fix that lands during a Refresh does not get its own re-read. The in-flight Refresh usually returns the post-fix state, so this is best effort. A queued reload is a page-wide change, so it was left alone.
- /standards-review: `{ deliveryNo, onFixed }` passes through FactsColumn to the section (Data Clumps / Middle Man), the same way FactsColumn already passes `attachments`. Left as is.
- document-rtl-drive has 1 failure ("ltr: every isolate is an inert inline box", on font-mono `8000000121` / `P001`). It is PRE-EXISTING: it fails identically with this slice's src reverted to HEAD 3479186. Not this slice's.

## Contract gap
None. The section uses 496's `GET PickSupport/Delivery/{deliveryNo}` door and 497's fix door unchanged.
