---
status: open
spec: 160
blocked-by: 168
---

# 170 — theBasketCorrectsItselfAndTheReceiptIsEngineTruth

## What to build

The ordinary middle of a call: the caller changes their mind, and the basket keeps up without
starting over. **Change a quantity**, **change a unit of measure**, **void a line** — each a verb,
each returning the whole state, each rendered rather than patched.

Each line shows what it costs, the conditions behind that (the store price and VAT as separate
things, because VAT *is* a separate condition), and any promotion that fired on it.

The **receipt is engine truth**, at the end edge, never moving and never scrolling away: net, VAT,
the delivery fee, and the payable total, with *Place order* pinned to its foot.

🚩 **The console never sums lines.** `totals` is the engine's, full stop — a client-side total is how
the web starts quoting a different number from the till.

The **delivery fee is quoted live** as the basket changes, so crossing a threshold is something the
agent watches happen rather than discovers at submit. `waived` is rendered as an **outcome the agent
is shown, never a control they operate** — the owner's ruling when the fee's manual waiver was
removed (map note 4's correction).

## Spine reach

api (`ChangeQty`, `VoidLine`, `ChangeUom`) · logic (line view model: conditions, fired promotions,
frozen availability) · component (basket rows, receipt totals) · i18n · test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [ ] `aLineShowsWhatItCostsAndWhyWithoutSumming` — pure: the line view model exposes price,
      conditions and fired promotions straight from the projection, and the receipt view model reads
      `totals` — no code path adds line values together · pure
- [ ] `theBasketTakesCorrections` — drive: quantity, unit of measure and void each re-render from the
      returned state, the receipt's totals move with them, and the delivery fee re-quotes as the
      basket crosses its threshold — including the waived outcome, which has no control · flow
      (Playwright, extends `tools/callcenter-drive.mjs`, over fixture `02`)

## Boundaries

**Endpoints:** `POST CallCenterWeb/ChangeQty`, `VoidLine`, `ChangeUom`. Codes: `LINE_NOT_FOUND`
(usually a stale screen), `UOM_NOT_AVAILABLE`, `QTY_INVALID`. Fixture `02-two-lines-priced.json`
joins `payloads.ts`. ⚠ The **delivery-fee rule** is out of scope — it is WPF-resident and becomes
shared server code in [156](156-delivery-fee-shared-rule.md); this slice only *displays* what
`totals.deliveryFee` carries. A quantity raised beyond availability takes
[169](169-below-availability-accepted.md)'s confirm path.

## Done when

An agent corrects a quantity, a unit and a line without leaving the call, and every number on the
receipt is one the engine computed.

## Blocked by

[168](168-search-in-arabic-no-estimate-as-money.md) — there must be lines to correct.
