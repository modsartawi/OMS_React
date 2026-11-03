---
status: open
spec: 734
blocked-by: 736, 737, 739
---

# 740 — Ask the OMS and the sourcing advisor work live on staging

## What to build

The live door ticket: the web half meets the real BO-1 and BO-2 doors on staging, and the demo
moments are proven. Walk it with a read-only live drive plus the owner.

**Wire check.** Reconcile every stubbed shape (D10, D20) with what the doors actually send. Record
any drift in the spec first, then fix the client.

**Copilot:**
- Both demo stories (D12) answer correctly, with the expected tool calls in the trace. Demo order X
  comes from [the demo-script ticket](731-what-does-the-live-demo-walk-show.md).
- The evaluation set (D14) passes on the configured connector.
- Switch the staging config to the **other** connector (Claude ↔ Gemini), re-run the set, and record
  both results. This proves the switch works by configuration alone (D4).

**MCP:** with one issued token, Claude Desktop or Claude Code lists the catalogue's tools and
answers one demo story.

**Sourcing advisor:**
- the 30-day simulation and one explanation render from real scored data;
- the "Why this store?" link works from a real delivery.

**Personal data:** an attempt to paste a mobile number is refused with `COPILOT-403`, and the audit
shows a record for it.

**Fallback recording:** record both copilot stories and the sourcing drill, for the pitch's
fallback.

## Spine reach

test (live drive + owner walk) · any client fix for wire drift

## Proof (→ `tdd` red-green cycles)

- [ ] `copilot-live-drive`: read-only, on staging; covers both demo stories, the trace, a refusal and
  RTL · flow (live)
- [ ] `sourcing-advisor-live-drive`: read-only; covers the summary, one explanation and the link ·
  flow (live)
- [ ] Owner walk recorded in this ticket, including both connectors' evaluation results and the MCP
  check.

## Boundaries

Needs BO-1 and BO-2 deployed to staging, and IT's approval for the key and egress (D9). Never runs
against production without the owner.

## Done when

Both live drives are green on staging, the owner walk is recorded, and the fallback recordings exist.

## Blocked by

- [736](736-a-copilot-answer-links-its-orders-and-shows-how-it-got-there.md)
- [737](737-copilot-follow-ups-keep-context-and-every-refusal-reads-plainly.md)
- [739](739-the-sourcing-advisor-shows-what-cheaper-sourcing-would-have-saved.md)
- BackOffice spec 3345 (filed 2026-11-03): BO-1 = 3346–3349, BO-2 = 3350–3353, all open
- IT approval for the key and egress (D9)

## Comments

- 2026-11-03: `/implement 740` stopped before any build because the ticket is not on the frontier
  (no server doors exist). BO-1 and BO-2 were filed as BackOffice spec 3345 with tickets
  3346–3353. The web half (735–739) was merged to main (ff 391d8b56, unpushed). `npm run lint` is
  red on main from `insurance-rules/aliases` importing `../fields` and `../labels`. That predates
  this merge and is not this wave's.

## Open questions

- The D9 deadline: if staging egress isn't approved by 2026-11-24, the pitch uses the recordings.
- S2: finance's rates must be in before any SAR saving from this walk goes on a slide.
