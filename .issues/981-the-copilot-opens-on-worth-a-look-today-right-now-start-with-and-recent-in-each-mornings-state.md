---
status: open
spec: BackOffice 4412
blocked-by: 980, BO 4429
---

# 981 — The copilot opens on Worth a look today, Right now, Start with and Recent, in each morning's state

Spec: BackOffice `E:\Projects\BackOffice\.issues\4412-the-copilot-warns-early-explains-the-nights-top-warnings-and-opens-on-them-spec.md`.

## What to build

The copilot panel's empty state becomes the opening screen, read from the server's one opening route: greeting,
"Worth a look today" (up to 5 cards in the order the server sends), "Right now" only for operations readers and only
when the server sends it, "Start with", "Recent". "Open" opens the stored investigation; "Ask about this" starts a
conversation about it. Each state (nothing raised, run failed or late, follows nothing) shows its words. Good news
uses its own colour. The screen computes and reorders nothing.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [ ] the cards render in the server's order, nothing reordered or computed · vitest
- [ ] Right now shows only for operations readers when sent · vitest
- [ ] nothing raised, failed run and follows-nothing each show their words · vitest
- [ ] Open opens the investigation; Ask about this starts a conversation about it · vitest

## Boundaries

Front end only. Shown only when the server offers it (`Copilot:OpeningScreen`). Help updated (or why not): the copilot article's opening section.

## Done when

The tests are green, and on dev the panel opens on last night's explained warnings.

## Blocked by

[980](980-a-clickable-mock-of-the-copilots-opening-screen-for-the-owner-to-react-to.md)
BackOffice 4429 (`E:\Projects\BackOffice\.issues\4429-the-opening-screen-route-the-briefs-what-changed-overnight-and-the-command-center-tool-return-the-explained-warnings.md`)
