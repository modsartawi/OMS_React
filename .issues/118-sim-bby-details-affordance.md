---
status: open
spec: 110
blocked-by: 112, 117, 123
---

# 118 — A promotion card opens its bonus buy details

## What to build

Put a `Bonus buy details ▸` control on the promotion cards built by
[117](117-sim-promotions-rail.md), opening the bonus-buy record as a **modal in place** — the single
principled exception to expand-in-place, earned because it is another record, another endpoint and
another grant.

**Both cards carry it, and the near-miss is the *stronger* case, not the weaker one.** The captures found
a missed promotion carries **no prerequisite data on the wire**, so the modal is the *only* route to a
miss's rules. If the affordance is ever cut back, it is **kept on the miss**.

**The gate, and the finding that decided it.** The inquiry feature's access probe degrades an unreachable
endpoint to *granted* — correct for a read-only inquiry screen, **wrong here**: reused verbatim it would
put a button on every card that fails on every click, today, on live SIS.Api. So Simulation gates on
**`probed && screenAllowed`** — **unknown means absent** — and the affordance **ships dark** until the
backend detail endpoint exists.

**The rail never waits on the probe.** The verdict is the screen's primary answer and must not be delayed
by a permission check; cards render from the promo view immediately and the control appears if and when
the probe resolves to a confirmed grant.

Placement: **last on the card, below the amount, and never a chip** — no chip on this screen is ever
clickable, which is what makes "a chip is a readout" enforceable.

**Navigation was rejected** and should not be reconsidered without new information: the inquiry page reads
**no search params**, so deep-linking to it would mean adding behaviour to another feature's screen —
exactly the out-of-line change the option existed to avoid.

## Spine reach

component (the card control; the modal mounted from `@/core/`) · i18n · test (drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `the control is absent when the grant is unprobed, present when confirmed, absent when denied` — all three probe states, including the degraded-to-granted trap · **flow (Playwright, new `tools/sim-bby-gate-drive.mjs`)**
- [ ] `the promotions rail renders before the probe resolves` — the verdict never waits on a permission check · **flow (same drive)**
- [ ] `the control opens the bonus-buy modal in place and closing it returns to the basket` — on both a fired and a near-miss card · **flow (same drive)**

Commission `tools/sim-bby-gate-drive.mjs` here, stubbing the probe across its three states — the gate is
one boolean and needs no pure test, but its *consequence* is a mount decision that only a rendered tree
shows.

## Boundaries

**No new API endpoint is built here** — the detail endpoint is a designed, unbuilt contract, which is
exactly why the affordance ships dark. The existing access probe is consumed unchanged; its degrade-to-
granted behaviour is **not** modified (it is correct for the inquiry screen), it is *interpreted more
strictly* at this call site. **i18n:** `promo.bbyDetails` is already minted by
[123](123-sim-i18n-key-expand.md); call it, do not add keys here. The modal's own copy stays in the
`bonus-buy-inquiry` namespace, **unchanged and un-renamed** despite the `@/core/` move — namespaces are
flat and feature-named regardless of folder.

**Concurrency:** this slice owns `tools/sim-bby-gate-drive.mjs` and **drive port 5202**.
[119](119-sim-responsive-arrangement.md) runs in the same wave on its own drive and port. Work in a git
worktree.

## Done when

Driving the app with the probe stubbed: the control appears on both card kinds only when the probe
confirms a grant, is absent when the probe is unreachable or denied, the rail renders without waiting on
it, and clicking it opens and closes the bonus-buy modal over the basket. `tools/sim-bby-gate-drive.mjs`
green, `npm run lint`'s boundary gate green.

## Blocked by

- [112](112-bby-detail-modal-to-core.md) — the modal must be in `@/core/` first; importing it from the
  inquiry feature is a boundary violation the lint gate catches.
- [117](117-sim-promotions-rail.md) — there are no cards to carry the control until the rail exists.
- [123](123-sim-i18n-key-expand.md) — `promo.bbyDetails` is minted there.
