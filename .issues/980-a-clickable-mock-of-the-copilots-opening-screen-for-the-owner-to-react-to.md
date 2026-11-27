---
status: open
spec: BackOffice 4412
blocked-by: —
---

# 980 — A clickable mock of the copilot's opening screen, for the owner to react to

Spec: BackOffice `E:\Projects\BackOffice\.issues\4412-the-copilot-warns-early-explains-the-nights-top-warnings-and-opens-on-them-spec.md`.

## What to build

BackOffice ticket 3582 settled the opening screen in words only and asked for a mock first. Build it on fixtures:
the greeting with the data-as-of and the run status when not ready; "Worth a look today" with up to 5 finding cards
(the explanation's first sentence, the figure against what was expected, a colour by good or bad direction, Open and
"Ask about this"), the reader's followed areas first; "Right now" for operations readers (deliveries open, late now,
the oldest open callout, each with its time); "Start with" (the starters); "Recent" (the last 5 investigations). The
other mornings: "Nothing unusual last night"; "Last night's check did not finish. The latest findings are from …"; a
reader who follows nothing. English and Arabic.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [ ] each morning's state renders from its fixture · vitest
- [ ] the owner's reactions are recorded in this ticket · a dated comment

## Boundaries

Prototype on fixtures; no server call.

## Done when

The owner has reacted, and the changes are written here for 981 and 982.

## Blocked by

None — can start immediately
