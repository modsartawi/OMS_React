# HITL — ticket 480 (Deliverect stores: stock sync, pause/resume, logs)

## Q: Which sync health wins when several hold — paused, failed, overdue?
**Decision taken:** Paused first (never overdue, never red — the Last status column still shows the code), then failed (red), then overdue (amber), then ok / not run yet (neutral).
**Why:** The briefing says a paused store "shows Paused instead"; spec 2615 story 27 pauses a store *because* its stock data is bad, so a red row that never clears would be noise.
**Revisit if:** The owner wants a failed last run to stay red on a paused store.

## Q: "No delta run in the last 60 minutes" — the last delta, or the last run of either kind?
**Decision taken:** The latest run of EITHER kind (`max(lastFullRun, lastDeltaRun)`); the badge's title says "No run in the last 60 minutes." Thresholds are named constants (`FULL_SYNC_HOUR` 7, `FULL_SYNC_GRACE_MINUTES` 30, `DELTA_OVERDUE_MINUTES` 60) in `sync-health.ts`, pointing at spec 2615 "Cadence".
**Why:** Spec Cadence: "a delta at least 30 minutes after the previous one" — a full at 07:05 is the previous run, so at 07:31 with no delta yet the store is not behind; a delta-only reading would flag every store amber each morning.
**Revisit if:** The owner reads the ruling literally (delta only).

## Q: Is a store Deliverect has not linked yet, or one linked minutes ago, ever overdue?
**Decision taken:** Never while not linked (`deliverectLocationId` null — BackOffice 2624 syncs linked stores only). A store linked in the last 60 minutes gets that long for its first run; after that the normal rules apply.
**Why:** Otherwise a freshly linked store is amber before the worker could have run once.
**Revisit if:** The owner wants unlinked-but-active stores flagged.

## Q: How is a log run with no `endTime` shown?
**Decision taken:** End reads "Running" and its status is shown as sent, neutral — never as Failed (the contract enumerates no in-flight status).
**Why:** A run still going is not a failure; red would alarm on every in-flight delta.
**Revisit if:** BackOffice 2624 always writes `endTime` (then this branch is dead) or names a running status.

## Q: Which columns does the grid show for the sync?
**Decision taken:** Stock sync (Active/Paused — 477's cell, unchanged), Sync health (badge, title says which run is behind), Last full run, Last delta run, Last status (raw code), Last error (contract field). Pause/Resume and Logs appear on rows that carry a sync block only. Failed rows red, overdue rows amber (row ground via `--ag-data-background-color`, painted check in the drive).
**Why:** The ticket names active, last full, last delta, last status and the highlight; the health badge carries the highlight in words (colour alone is not enough) and lastError is on the wire.
**Revisit if:** The owner wants fewer columns.

## Q: What does the pause dialog promise?
**Decision taken:** "Pausing stops the stock pushes only: the store stays listed on every delivery platform and it can still receive orders." It does not promise the last stock is kept (spec 2615 leaves PLU retention an open Deliverect question), nor point at busy/closed (481, not built yet).
**Why:** Glossary **Stock sync (paused)** + contract "It does not take the store offline on the platforms".
**Revisit if:** Deliverect confirms stock retention, or 481 lands and the owner wants the pointer.

## Q: How does the screen notice a store turning overdue while open?
**Decision taken:** A 60-second clock tick refreshes the health cells and redraws only the rows whose highlight changed. No refetch. Sorting by health does not re-sort on a tick (it does on the next read).
**Why:** Overdue is a function of time, not data.
**Revisit if:** —

## Contract gap

- **Sync/{store}/Active answer and refusals are unspecified.** 480 reads nothing from the PUT and refetches the list; any refusal shows in the dialog with its code (DLV-00009 inline). **Ask:** name the answer and refusals (DLV-00001 for an unknown store? a store not onboarded?).
- **`lastStatus` / log `status` enumerate only `"S"`.** Ruled: "S" ok, any other non-null failed, null neutral. **Ask:** enumerate the values (and whether an in-flight run has a status / null `endTime`).
- **`callbackStatus` enumerates only `"processed"`.** Shown raw; null reads "Not yet". **Ask:** list the values.

## Outstanding (not AFK's)
- Owner sign-off on the overdue thresholds, the paused-beats-failed order and the either-run reading above.
- Owner's eye on the Arabic rendering (the app's `lng` stays `en`; RTL drive proves direction only).
- Live doors on staging (483, BackOffice 2624).
