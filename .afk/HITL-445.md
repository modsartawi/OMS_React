# HITL log — ticket 445 (sync console Fleet page)

## Q: Contract drift — the envelope's error entries
**Decision taken:** The door contract abbreviates errors as `errors: [{ code, message }]`; the real SIS.Api envelope `src/core/api.ts` reads is `errors: [{ errorCode, errorMessage, internalErrorCode }]`. The drive stubs the REAL shape (coupon-import-delete drive's `envelope()`), and codes are read only through `apiErrorCode` / `apiErrorMessage`.
**Why:** `api.ts` is the one reader of the envelope; stubbing the abbreviated form would prove nothing.
**Revisit if:** BackOffice 2539 ships an envelope that really does carry `{ code, message }`.

## Q: What does a state tile do when clicked — replace or toggle?
**Decision taken:** A state tile TOGGLES that state in the filter; two tiles send `state` twice (AND, as the contract says). "All stores" clears every state. States are kept in the contract's order so the query string is stable.
**Why:** The ticket says "each one sets the table's state filter (repeated, AND)"; only toggling lets the repetition happen.
**Revisit if:** The owner expects one tile at a time (radio behaviour).

## Q: Where does the "pending" badge sit in a row?
**Decision taken:** The State column shows every door state except `controlPending`; a separate Control column (as in the prototype) shows "Pending" read off the row's `controlPending` field.
**Why:** The wave rule is "the pending badge reads controlPending", and the prototype gives it its own column.
**Revisit if:** The owner wants every `states[]` entry in one cell.

## Q: Severities for each state
**Decision taken:** offline/erroring → bad, behind → warn, onWpf/paused → mute, onWorker/controlPending → go (blue), unknown → mute with the raw code.
**Why:** Matches the prototype's colours, mapped onto the app's five severities (it has no purple "pending").
**Revisit if:** The owner wants "Control pending" to stand out more (e.g. warn).

## Q: A worker list that comes back empty
**Decision taken:** Red banner "No worker has reported" — the same loudness as a stale heartbeat.
**Why:** Story 3: a dead worker must never look like a quiet fleet. This reads the absence of rows; it does not derive staleness.
**Revisit if:** The door always lists a registered worker, so an empty list is impossible.

## Q: How many model types does 445 land?
**Decision taken:** `src/core/models/sync-console.ts` holds every shared enum, the shared shapes (`LoopHealth`, `StoreRow`, `Paged`), the access probe, and the four read doors the Fleet page calls. The store, command, audit and onboarding shapes are left for the slices that first read them (446–449 extend this one file). Type names carry a prefix where the contract's bare name would clash or be vague in `core/models` (`SyncHost`, `SyncLoop`, `SyncWorker`, `SyncConsoleAccess`); the fields are exactly the contract's.
**Why:** Keeps 445 to what it renders, with no speculative types.
**Revisit if:** A later slice would rather have had the whole contract typed up front.

## Q: Background refresh while the tab is hidden
**Decision taken:** React Query's default: the 30 s poll pauses in a hidden tab and catches up on focus. The "as of" stamp shows how fresh the numbers are.
**Why:** Conservative on load; the spec only says "refreshes every 30 s".
**Revisit if:** The delegate keeps the console open as a wall monitor in a background tab.

## Q: The Last error cell
**Decision taken:** It shows the newer of `push.lastError` and `pull.lastError` (compared as fixed-format strings, no Date built), truncated, with no tooltip. The bidi rule forbids `fsi` in a column file, and the store page (446) shows the whole message.
**Why:** The prototype has one "Last error" column, and the contract has two loop errors.
**Revisit if:** The owner wants the connect error (`lastConnectError`) in that column as well.
