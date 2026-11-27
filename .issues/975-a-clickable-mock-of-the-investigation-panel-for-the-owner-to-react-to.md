---
status: open
spec: BackOffice 4411
blocked-by: —
---

# 975 — A clickable mock of the investigation panel, for the owner to react to

Spec: BackOffice `E:\Projects\BackOffice\.issues\4411-the-copilot-investigates-a-why-question-to-its-cause-spec.md`.

## What to build

BackOffice ticket 3579 settled the investigation panel in words only and asked for a mock first: the owner reacts
to it before the rest of the web work is built. Build it on fixtures, in the copilot panel, as a prototype branch:

- **While it runs:** the progress card listing the steps in the reader's words ("Checking the data is complete",
  "Finding what changed", "Looking inside Riyadh", "Comparing with similar stores", "Checking promotions", "Writing the
  answer"), "You can leave; I will keep this under Recent", and Stop.
- **When it is done:** the cause line with its share; "What I found" (one level per row, a sentence and a small
  table, collapsed below the first); "What I assumed" as chips; "What I could not establish"; "What to do" (the
  playbook card, or the labelled suggestion "A suggestion, not a company playbook"); "Ask next" (up to 3 buttons); the
  foot (data-as-of, how I got this, 👍/👎, Run again, Save as report).
- **The other states:** not real ("It did not really drop", with the normal band); spread evenly; budget ended ("I ran
  out of time; this is what I have" and Continue); queued; failed ("This did not finish" and Run again).
- Recent investigations from the panel header. English and Arabic, right to left.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [ ] each state renders from its fixture · vitest
- [ ] the owner's reactions are recorded in this ticket · a dated comment

## Boundaries

Prototype on fixtures; no server call. Not merged as product code: the next tickets build from what the owner keeps.

## Done when

The owner has reacted, and the changes are written here for 976-978.

## Blocked by

None — can start immediately
