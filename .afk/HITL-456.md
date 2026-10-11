# HITL log — ticket 456 (fleet page: mirror lane and mirror workers)

## Q: The ticket says "the existing assertions stay green", but it also grows the tile row and the sort list. What happens to the two drive assertions that pin them?
**Decision taken:** Changed two assertions in `tools/sync-console-fleet-drive.mjs` on purpose, each with a comment: "eight tiles" became twelve, and "the four sorts" became six. Also changed one vitest, `the tiles offer All and every state` in `helpers.test.ts`, which now expects every state except `railsDisagree`. Every other assertion is unchanged. The default stubs stay in the shape the doors had before 2563, so the boundary fill runs on every old check.
**Why:** The four mirror tiles and the two mirror sorts are what the ticket asks for. Those three assertions pin the old counts and cannot stay green once the ticket's own feature exists.
**Revisit if:** The owner meant that the old tile and sort assertions should be kept, with the new ones held behind a flag.

## Q: Should the fleet's State column still show the mirror states, now that the lane chip carries them?
**Decision taken:** Yes. The State column is unchanged and shows every state the door sent (except `controlPending`, as before), mirror states included. The chip adds the colour of the worst mirror state, and its hover gives that state's name.
**Why:** It keeps the shipped column's behaviour. The colour is never the only signal, because each mirror state still has a word in the row. Nothing the door sent is hidden.
**Revisit if:** A human eye on the row finds the duplication noisy. Then drop the mirror set from the State column and list the states in the chip.

## Q: The ruled fill list leaves `Fleet/Summary` out. What does an old door's summary draw on the four mirror tiles?
**Decision taken:** It is not filled. On a door from before 2563, the four mirror tiles show a blank count rather than `0`. Clicking one, or choosing a mirror sort, sends `state=` or `sort=` values that the old door rejects with its own `BAD_FILTER`, and the table shows that refusal through the existing error path.
**Why:** A `0` would claim that no store is offline on the mirror rail, which the console does not know. The ruling lists exactly which reads get filled, and Summary is not on the list.
**Revisit if:** The owner prefers to hide the mirror tiles and sorts until the summary carries their counts.

## Q: Ticket 456 owns `AuditAction`, but 458 owns the audit labels. `control-helpers.ts`'s exhaustive `Record<AuditAction, true>` no longer compiles. What should change?
**Decision taken:** Added an `UnlabelledAuditAction` type (`MirrorRetry | MirrorAcknowledge | AgreementRecheck`), and the `Record` excludes it, so until 458 those three actions show their raw code. A comment tells 458 to delete the type, not just add the keys.
**Why:** This follows the ruling that the labels are 458's, and it keeps the rest of the record exhaustive.
**Revisit if:** 458 lands without deleting the type.

## Q: Which fleet columns should carry the lane, and where should they go?
**Decision taken:** Three columns go right after the counter rail's "Last pull" cell:
- **Mirror lane**: the chip.
- **Oldest on the till**: `tillBacklogOldestAt` with the small "till clock" hint.
- **Last mirror pull**: `mirror.lastPullAt`.

At 1600 px wide these columns sit to the right of the visible area, beside the Last error and Control columns that were already there.
**Why:** The ticket asks for the lane "beside the Master and Counter lanes", and the ticket requires the till-clock hint on `tillBacklogOldestAt`. Spec 2563 lists "last pull" as part of the lane (story 6).
**Revisit if:** The human eye on the lane wants it next to State, or wants "Last mirror pull" dropped.

## Q: How should the mirror tick outcomes that the rulings do not name be coloured?
**Decision taken:**
- `Swept` and `Applied` are `ok`.
- `SkippedLockHeld` is `mute`, because another instance holds the lock and is doing the work.
- `None` is `mute`, labelled "Never ticked".
- The ruled ones are unchanged: `SkippedBackpressure` is `warn` and `Faulted` is `bad`.
- An unknown outcome falls back to `codeBadge` (neutral, raw code).

**Why:** These follow the console's existing severity vocabulary (`ok` means went well, `mute` means neutral).
**Revisit if:** The owner wants a held lock to read as a warning.

## Q: What happens to a `Workers` item whose `rail` is a value this bundle does not know, or to a pull role with a null inbox figure?
**Decision taken:**
- An item with an unknown `rail` is left off the card, because its shape cannot be narrowed.
- The pull role's "inbox pending / threshold" figure is drawn only when both numbers are present.
- A lane the door sent only partly is passed through as-is. Only a missing member is filled, as ruled.

**Why:** These are the conservative readings: the card never guesses a shape the contract does not define.
**Revisit if:** A later door adds a third mirror role.

## Contract gap
None found for this slice. The model matches the section "Mirror lane and rail agreement" field for field.
