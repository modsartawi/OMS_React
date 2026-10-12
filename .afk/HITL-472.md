# HITL — ticket 472 (spec 470, receipt replay slice 0)

## Q: Does the Replay page's gate also need `screenAllowed`, or `canReplay` alone?
**Decision taken:** `canReplay` alone (`canReplayReceipts`, `=== true`), via core's `ScreenGate` with `keyPrefix="replay.access"` (its own five sentences: "No access to receipt replay").
**Why:** spec 470 rules `canReplay` independent; the nav link and the page read the same predicate, and the server grant stays the guard.
**Revisit if:** the BackOffice spec makes `ActionSync.Replay` require `ActionSync.Health.View` (then AND in `canOpenSyncConsole`).

## Q: What enables Push in slice 0?
**Decision taken:** a valid, completed **sale** (`pushReady`). A training or unbalanced sale can still be pushed in 472; the summary shows both facts as Yes/No.
**Why:** the ticket says "Push needs only a valid completed sale. Full warnings are 473's"; the runner says not to build 473 early.
**Revisit if:** 473 lands — it must add `!training && balanced` to `pushReady` (spec 470: "Push is enabled only for a completed, non-training sale that balances").

## Q: Which invalid reasons does the preflight have beyond "not JSON"?
**Decision taken:** `empty`, `json` (with the parser's offset → line/column), `notObject`, `noHeader`, `noTotal`, `tenderAmount` (a tender with no numeric `AppliedAmount`, or `Tenders` not an array). A missing `Lines` counts 0 lines; a missing `Tenders` is 0 tendered (so unbalanced unless the total is 0).
**Why:** the runner rules "missing numbers are NOT zero" — a missing tender amount is a missing number; a missing array is a count, not a number.
**Revisit if:** a real staging snapshot carries a tender with a null `AppliedAmount` legitimately (then 476 should log it as a contract gap).

## Q: Where does a refused push show?
**Decision taken:** inside the confirm dialog (it stays open; a fresh opening clears it). A refused registers read shows under the target. Both use the drawer's refusal idiom: `failureLabelKey` words with the code beside (`NO_STORE`), else the server message + code, a codeless 500 under the sentence alone.
**Why:** the tester acted in the dialog, and ReasonDialog shows its own failure the same way.
**Revisit if:** 473's owner wants refusals on the page beside the JSON instead.

## Q: The existing console drives' nav assertions — which changed?
**Decision taken:** none. No drive asserts the full ConsoleNav list, and every existing Access stub omits `canReplay`, so the Replay link is absent there exactly as before. Store 307/307, controls 110/110, onboard 83/83, commands 69/69, fleet 88/88 — unchanged.
**Why:** the ticket's Proof box anticipated a change; there was nothing to change.
**Revisit if:** a later drive starts enumerating the nav.

## Q: How does the target store field read its registers?
**Decision taken:** the console's `TextField` gains an optional `onCommit` (Enter and blur); the code is trimmed + upper-cased and shown back that way. A new code clears the picked register. The register `<option>` shows `registerId · name` as one `fsi`-wrapped pair.
**Why:** the ticket says "On Enter or blur"; extending the console's own field avoids a second input style.
**Revisit if:** — 

## Q: What does a push invalidate?
**Decision taken:** the console's audit feeds (`AUDIT_KEY`), since the door writes one audit row per push. The recent replays list is 475's.
**Why:** same as the snapshot drawer's served view.
**Revisit if:** —

## Contract gap
- **Registers door, a NewPos store with no registers:** spec 470 does not say whether that is `registers: []` or a refusal. Built: an empty list reads "This store has no registers." and Push stays disabled.
- **`replayedAt` format:** not pinned by spec 470. Assumed the console's wall-clock string (`yyyy-MM-ddTHH:mm:ss`, no offset) and shown through `formatDateTime`.
- **Invalid-JSON position:** read off V8's `JSON.parse` message ("at position N"; "end of JSON input" → the text's end). A browser with another message shape shows the sentence with no position (never a wrong one).

## Q: Should editing the JSON, the store or the register clear the last result?
**Decision taken:** yes. A result describes the JSON and the target it was pushed with; showing it beside a different paste could get the wrong receipt number copied (/code-review finding).
**Why:** that is the safer reading for a tester who copies the number to a till.
**Revisit if:** testers want the last receipt number kept on screen while they edit.

## Q: Review findings not acted on
- **canReplay-only users cannot find the page.** ConsoleNav only renders on `screenAllowed` pages, and there is no menu leaf. This follows the runner's rulings (no new menu leaf; the link lives in ConsoleNav). The page itself works for them.
- **The balance is judged to the cent while money shows 3 decimals.** The runner ruled `Math.round(x * 100)`.
- **`Header.StoreId` may not be the code.** The runner ruled the source fields; 476 confirms against a real snapshot.
