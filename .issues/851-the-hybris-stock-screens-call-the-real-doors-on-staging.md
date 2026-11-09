---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3447-hybris-stock-sync-atp-to-the-hot-folder-spec.md
blocked-by: 848, 849, 850, BackOffice 3453, BackOffice 3454, BackOffice 3455, BackOffice 3456
---

# 851 — The Hybris stock screens call the real doors on staging

## What to build

HITL walk on staging, rail in **shadow**: mark and unmark a store, upload a material list, see deltas
and a full in the log with their lines and a material's history, push a store and materials now, see 409
by pushing twice. Record findings in Comments.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3447-hybris-stock-web-door-contract.md` (written by BackOffice 3453, extended by 3454-3456).
Pattern: the HungerStation and Deliverect pages (`src/features/hungerstation`, `src/features/deliverect`).

## Spine reach

UI → app (BackOffice doors, stubbed until 851)

## Proof (→ `tdd` red-green cycles)

- [ ] every page walked against staging SIS.Api, LTR and RTL
- [ ] findings recorded

## Boundaries

oms-react only. Actions gated by the `Access` door (view / manage). On staging the rail stays in **shadow**, so Hybris never imports anything this page triggers.

## Done when

The proof is green; the live check rides 851.

## Blocked by

- [848](848-the-hybris-stock-materials-page-uploads-with-a-preview.md)
- [849](849-the-hybris-stock-push-log-opens-a-pushs-lines-and-a-materials-history.md)
- [850](850-push-now-from-the-hybris-stock-stores-page.md)
- BackOffice [3453](C:/Work/DMSCO/BackOffice/.issues/3453-the-hybris-team-marks-and-unmarks-hybris-stock-stores-with-a-reason.md)
- BackOffice [3454](C:/Work/DMSCO/BackOffice/.issues/3454-the-hybris-team-uploads-and-edits-the-hybris-stock-material-list.md)
- BackOffice [3455](C:/Work/DMSCO/BackOffice/.issues/3455-operations-read-the-push-log-its-lines-and-a-materials-history.md)
- BackOffice [3456](C:/Work/DMSCO/BackOffice/.issues/3456-the-hybris-team-pushes-a-store-or-chosen-materials-now.md)

## Comments

**2026-11-07 — not started: BackOffice 3453–3456 are unbuilt, and the contract asset does not exist.** 847–850
were built on branch `spec/3447-hybris-stock` (worktree `C:\Playground\oms-react-spec3447`) against stubs of a
GUESSED contract. Before the walk, reconcile these with the real doors:

- Every route, field and refusal code lives in `src/core/models/hybris-stock.ts`; the drive stubs in
  `tools/hybris-stock-stubs.mjs`. Prefix `HybrisStockWeb/`; codes `HYS-00001`…`00011` + `HybrisStockPushBusy`.
- **BO asks raised by the build and its reviews:**
  1. Stores rows carry `deltaBehind` / `fullOverdue` flags (the client never does the arithmetic).
  2. The preview's refusal codes `unknownMaterial | malformed | badEnabled | repeated`.
  3. A push carries `linesSwept`, and ideally the Lines answer too (or a `GET Pushes/{id}`): a push opened from a
     link that is not on the loaded log page cannot otherwise tell "swept" from "no lines".
  4. Story 21 (material change history) has no read door in the spec; nothing on the web shows it.
  5. Material numbers are checked client-side as 1–18 digits (push materials now, add); confirm no letters.
- Drives: `tools/hybris-stock-{stores,materials,pushes}-drive.mjs` (stubbed, 120/67/56). A live twin should be
  GET-only plus the shadow-mode writes the ticket names.

**2026-11-09 — the guessed contract is reconciled to the real door contract (not yet walked live).** Branch
`spec/3447-hybris-stock` merged `main` (852's Access-probe gating kept; the Hybris stock group stays on its ONE
`HybrisStockWeb/Access` probe) and then moved every client shape to
`C:\Work\DMSCO\BackOffice-3447\.issues\assets\3447-hybris-stock-web-door-contract.md` (BackOffice branch `spec3447`,
tip `6749be2de`; routes cross-checked against `Services/SIS.Api/Endpoints/Sd/HybrisStockWebEndpoints*.cs` and the
`…/StockSync/Web/*Models.cs`). Gates: typecheck clean, `npm test` 9949/9949, lint green except the pre-existing
insurance-rules/aliases boundary violation (not ours); drives (stubs rebuilt to the real shapes) stores 125/125,
materials 73/73, pushes 64/64.

Guessed → real, each fixed in models, api, pure modules (red-green), UI, en+ar keys, stubs and drives:

- **Refusal codes, renumbered.** Mark closed `HYS-00003` (new), already marked `00004`, unmark not marked `00005`
  (the guess had one `00003` for both); unknown material `00004`→`00010`; already listed `00005`→`00011`; new
  `00012` not listed / `00013` already enabled / `00014` already disabled (re-read + Confirm off); preview gone
  `00006` (404) → `00015` (409: file or list changed since the preview — the dialog now offers **Preview again**);
  file unreadable `00007`→`00016`; no such push `00008`→`00020`; push busy `HybrisStockPushBusy`→`HYS-00030`; not
  marked `00009`→`00031`; rail off `00010`→`00034`; new `00032` material not enabled and `00033` selection limits;
  caller faults `HybrisStockFilterUnknown` / `HybrisStockInputInvalid` modelled.
- **No 502 `HYS-00011`.** A failed push-now upload is a **200 with `status: "E"`** and `error`: the result box says
  failed with the server's error (never "delivered"), the list and log are re-read; the `sinkFailed` refusal is gone.
- **Status**: + `target`, `targetPath` (now shown in the mode banner), `maxRowsPerFile`, `minutesBetweenParts`;
  alerts are `{ kind, title, raisedAt }` with kinds `upload-failing | stock-visibility | store-behind` (guess:
  `{ kind, message, since }`, camelCase kinds).
- **Stores**: filter `marked=` → `flag=any|marked|unmarked`, plus the new `health=any|ok|unhealthy` (now a filter on
  the page; URL mirrors the door). Row `changedAt/changedBy` → `markedAt/markedBy` (null while unmarked); + `closed`
  (a closed marked store shows **Closed**, keeps Unmark, and a closed store is never offered Mark); health + the
  server's `healthy` verdict (honoured: `healthy: false` paints red even with no cause flag).
- **Store history**: `{ at, by, action: mark|unmark }` → `{ changeId, action: M|U, door, reason, changedBy, changedAt }`.
- **Materials**: `materialName` → `nameEn` + `nameAr` (two columns) and `lastEnabledAt` (a column); material number
  is letters, digits, `. _ -`, up to 30 (guess: 1–18 digits) for add and push now; Add body may carry `enabled`.
- **Enable / disable**: `PUT …/Enabled { enabled, reason }` → `POST …/Enable` / `…/Disable { reason }`.
- **Upload preview**: `{ uploadId, fileName, counts, rows }` → `{ contentHash, counts, rows }`; rows `line` →
  `rowNumber`, `wasEnabled` → `currentEnabled`, no `materialName` (the preview table dropped its name column);
  refusals `malformed | repeated | unknownMaterial` (the guessed `badEnabled` is folded into `malformed`). The
  stub reads headers by name, as the contract does.
- **Upload commit**: `POST Upload/{uploadId}/Commit { reason }` (JSON) → `POST Upload/Commit` multipart `file`
  (the same File, held with its preview) + `contentHash` + `reason`; answer `{ uploadId, added, changed, … }` →
  `{ uploadId (null when nothing changed), counts }`.
- **Push log**: `GET Pushes?…&skip=&take=` → `{ total, rows }` became a **bare array, `take` only (no skip, no
  total)**: the page reads the newest 50 and **Show more** asks 50 more up to the door's 500 (`?take=` in the URL).
  Type `D|F|S|M` → `delta|full|now-store|now-materials`; status `R|S|E` → `running|sent|failed`; `files` →
  `fileNames` (+ `fileCount`); + `statusText` (the status badge's tooltip), `storeCount`, `targetPath` (target
  tooltip, lines header), `parts` (a running split push reads "1 / 2 parts up"); `linesSwept` (true = gone) →
  `linesKept` (false = gone). The screen-clock retention guess is removed: the server decides.
- **Lines**: + `linesKept` on the answer, so a push opened from a link alone can tell swept from empty (resolves the
  2026-11-07 ask 3).
- **Store material history**: rows lose `target`; type/status in the log's words (the drawer's Target column is gone).
- **Push now**: materials door `Pushes/Materials` → `Pushes/MaterialsNow`; the answer is its own shape
  `{ pushId, pushType: S|M, status: S|E|R, storeCodes, rowsSent, fileCount, fileNames, target, targetPath,
  requestedBy, reason, startedAt, finishedAt, error }` (guess: the log row). The 200-store / 1,000-material limits
  are checked before sending.

The 2026-11-07 asks: 1 (health flags) and 2 (preview refusals) are answered by the contract; 3 is answered
(`linesKept` on both); 5 is answered (letters allowed). Still open, for a ruling or a follow-up:

1. **Push log reach.** With no `skip`/total, the log shows at most the newest 500 per filter; older pushes are reached
   only by narrowing the dates. BO ruling: is 500 enough, or should `Pushes` take `skip`?
2. **Material change history (story 21).** The contract now has `GET Materials/{n}/History` (actions A/E/D,
   `uploadId`), but no web page reads it yet — needs an oms ticket (ask 4 of 2026-11-07 is half answered).
3. **`statusText`.** The contract says "show `statusText`"; the client shows its own localized label ("Delivered to
   hot folder") with `statusText` as the tooltip. Owner ruling if the server text must be the visible label.
4. **Two vocabularies.** The push-now answer uses letters (`S|M`, `S|E|R`) while the log uses words
   (`now-store`, `sent`, …). The client models both; worth aligning in the contract if 3456 is still open.
5. **History depth.** Store and store-material history are read at the door's default `take` (50); a store with more
   than 50 marks/unmarks shows the newest 50 only.
6. **Contract location.** The asset lives on BackOffice branch `spec3447` (worktree `BackOffice-3447`), not yet on
   BackOffice `main`; the model's header cites the main-repo path it will land at.
7. **Live proof still owed** — this ticket's walk against staging (LTR + RTL, rail in shadow) is unchanged.
