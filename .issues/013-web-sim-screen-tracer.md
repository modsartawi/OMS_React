---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\503-web-pos-simulation-spec.md
blocked-by: —
---

> **Impl note (build):** the i18n namespace landed as **`simulation`** (feature-structure rule —
> namespace == feature name; feature is `simulation` under area `pricing`), not `pricing` as the
> "What to build" bullet and spec 503 worded it. The access query key follows the namespace
> (`['simulation','access']`); the behavioural requirement — page-guard and menu probe share ONE
> key so they dedupe to a single call — holds. Sibling map 489 (`bonus-buy-download`) established
> the shared **Pricing & Promotions** area alongside this screen.

# 013 — POS Simulation screen: enter a basket, Process, see priced results

> Moved from BackOffice `.issues/510` (its shared 4xx sequence). Renumbered into oms-react's own
> tracker; server-side deps live in BackOffice and are linked by absolute path.

## What to build

The client tracer in oms-react: an authorised pricing analyst opens the **POS Simulation** screen,
enters a header + a basket of items, presses **Process**, and sees the totals and a per-line results
grid — proving the whole cookie → grant → engine → render pipe.

- New feature `features/pricing/simulation/` in a **new "Pricing & Promotions" nav area** (URL prefix
  `/pricing/*`, route `/pricing/simulation`); menu leaf in that group carrying the access probe; i18n
  namespace `pricing`.
- **Header form** — dense **4-column** grid (NOT the WPF's 2-column): plant / pricing date / sales org /
  distribution channel on row 1, procedure key + loyalty id/group/tier on row 2; **Promotion** and
  **Pricing Elements** checkboxes inline on the "Header" title row. Feeds `SimulateRequest.header`.
- **Items entry** — a basic grid to add rows (material, qty, UoM) — enough to Process; full editing is
  [016](016-web-sim-editable-grids.md). Client sends items in order; the server assigns item numbers.
- **Process** = a mutation to `POST Pricing/Simulate`; **Net Total + calc summary**; **results grid**
  (item / material / qty / subtotal / promo / gross / tax / net) with a **red/amber/green status dot**
  cell renderer on `pricingStatus`; **status banner** summarising error/warning counts. **Clear** resets.
- **Access guard (BackOffice issue-429 access-probe pattern):** the page self-guards on
  `GET Pricing/Access` (spinner → denied card when `!canOpen` → content); the menu leaf's access probe
  uses the **same query key** so nav-check and page-guard dedupe to one call. A pricing rejection
  surfaces as an inline error banner (the 400 `[PRICING_ERROR] message`); per-item E/W shows via the
  dots + no throw.

## Spine reach

app/UI (React screen) — consumes BackOffice 509's `POST Pricing/Simulate` + `GET Pricing/Access`.

## Proof (→ `tdd` red-green cycles)

- [x] Client verified (no client test tier — spec 503): `typecheck` + `build` green; a Chromium
      drive with the SIS.Api mocked at the envelope (dev backend not running in this env) exercised
      the real screen — Process → priced results grid (one OK + one `W` line), red/amber/green status
      dots, the E/W banner ("0 error(s), 1 warning(s)"), Net Total 115.00 SAR, Clear resets; the
      request carried the basket in order with no client-set item numbers and `includeConditions:true`.
      A second drive proved the denied path: `canOpen:false` → denied card + hidden nav leaf.
- [ ] Owner smoke (live sign-off, still pending — backend not available here): against dev SIS.Api
      (`:5111`, cookie mode) with a pricing DB and a user holding `POS_SIMULATION_ADMIN`, entering
      material 235275 + Process shows a priced results line; an ungranted user sees the denied card and
      the nav leaf is hidden. This is spec 503's owner-smoke seam (the dev-environment gap 419/476 note).

## Boundaries

oms-react repo (own workspace, map 478) — its area/feature-structure rules apply. No BackOffice change.
No bump, no flag. ag-grid Community. Depends on BackOffice 509's endpoints being deployed on the dev API.

## Done when

An authorised user can Process a basket on `/pricing/simulation` and read the priced results grid with
status dots + totals; an unauthorised user is denied (nav hidden + denied card + 403 on Simulate).

## Blocked by

None in-repo. The server slice it consumes — BackOffice
[509](C:\Work\DMSCO\BackOffice\.issues\509-web-sim-endpoint-gate-seed.md) (`Pricing/Simulate` +
`Pricing/Access` + grant) — is **done**.
