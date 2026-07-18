---
type: wayfinder-ticket
wayfinder: grilling
map: 017
status: done
blocked-by: 018
---

# 020 — Where the cache-bust is triggered

## Question

What surface(s) invoke the bust? Not mutually exclusive — decide the set:

- **Manual "Clear cache" button in the simulator header** (WPF parity): explicit analyst action
  before re-processing. Simplest to reason about; matches the old muscle memory.
- **Auto-evict on BBY download** (root-cause fix): the download endpoint evicts `bby:{n}` on
  success, so a re-download is coherent without any manual step. Could make the manual button
  redundant — or they coexist (button covers out-of-band SAP edits the download screen didn't make).
- **Per-simulate bypass flag:** `Pricing/Simulate` gains a "read fresh / skip cache" option so a
  single simulation ignores the cache without evicting it for everyone.

Decide which surface(s) the spec includes and which is the primary answer to the false-feedback
problem. Depends on 018 (is auto-evict-on-download reachable server-side; is a bypass flag feasible).

## Answer

**Two triggers, complementary:**

1. **Manual "Clear cache" button — in the POS Simulation header only** (WPF parity). Calls the
   whole-cache `Pricing/ClearCache` from ticket 019 (all 7 repos, no body). Not placed on the BBY
   Download screen or a global menu — kept where the old muscle memory lives. This is the primary,
   catch-all answer (covers condition-record + master-data staleness, per 019).

2. **Auto-evict on BBY download — YES.** On a successful `BonusBuyDownloadWeb/Download`, the server
   evicts **just** `bby:{number}` (targeted `RemoveAsync`, 018) so the most common case —
   re-download then simulate — is coherent by construction without any click. This is a **separate,
   narrower mechanism** than the manual whole-clear, not redundant with it. **Accepted cost:** a new
   cross-module dependency (the Retail.Data download seam gains access to the SIS.Pricing `"Pricing"`
   cache via `IFusionCacheProvider`); the spec must call this coupling out.

**Per-simulate "read fresh / bypass cache" flag — REJECTED, out of scope.** The whole-clear button
covers the need, and a bypass would require threading a skip-cache flag through every `Cached*Repository`
decorator — invasive for marginal benefit.

Net: the manual button is the safety net; auto-evict-on-download removes the most frequent reason to
reach for it.
