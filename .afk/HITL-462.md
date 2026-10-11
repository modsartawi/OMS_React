# HITL — ticket 462 (the IDoc inspector opens straight on a linked transaction)

## Q: Does a Look up push a history entry or replace the current one?
**Decision taken:** Replace. The inspector uses the core `useUrlQuery` hook (graduated at 463), which writes with `replace: true`.
**Why:** It is the repo's one URL-state convention (the fleet page and the Material search use it). It also handles the async echo of a router write, so this ticket did not need a second copy.
**Revisit if:** the owner wants Back to step through earlier lookups. That means push semantics in `useUrlQuery`, or a write of the inspector's own.

## Q: Should a link's lookup wait for the access probe?
**Decision taken:** Yes. The transaction query is enabled only once `canOpenIDocInspector(access)` holds. It reads the same probe key and options as the gate, so it is still one call.
**Why:** Before 462 nothing could fire before the gate drew. A link fires on mount, and without this a denied user opening a link would still have asked the server for the transaction. The drive asserts that it does not.
**Revisit if:** never, unless the gate moves.

## Q: What happens to the toolbar when the URL key changes from outside (Back, the menu leaf, a pasted link)?
**Decision taken:** The draft follows the URL, back to the landing draft when the key is gone, even over a half-typed draft. Only the echo of the page's own write (Look up, a refused Look up, Reset) keeps the draft. The answer view (selected document, open lines, filter) resets on every key change.
**Why:** The address and the screen must not disagree. `/code-review` caught a first version that decided by what the draft builds: it kept a stale half-typed draft when the menu leaf cleared the key.
**Revisit if:** the owner wants a half-typed draft to survive navigation.

## Out-of-slice findings from /code-review (NOT fixed here; they belong to committed 461/463-465 work)
- `core/ui/use-url-query.ts:33`: by the time a page's own effect asks `awaitingEcho()`, it is effectively always false, because the hook's effect runs first and settles the echo. The fleet page's search box can lose a keystroke typed while a debounced write is in flight. `DoubleSendsPage` resets its draft without a trim guard.
- `DoubleSendsPage.tsx:106`: changing the flag select commits the store box's unsubmitted draft, so a half-typed code reaches the door.
- `StoreDayPage.tsx:311`: the recompute invalidates the server-echoed `data.code`, while the store page keys on the route's `:code`. A case difference leaves the store page stale.
- `StoreStrip.tsx:71`: the day card and the range footer draw the raw `cell.day`, not through `formatDay`.
- `storeday-columns.tsx:134`: the held cell interpolates `held.held` / `held.of` raw, not through `figure()`.
- Cleanups: the canonical-order toggle is copied four times (storeday-helpers, fleet-query), and the refusal-code → key helper five times.
The inspector does not use `awaitingEcho`, so the first finding does not affect 462.
