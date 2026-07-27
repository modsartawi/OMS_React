---
status: done
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

- [x] `aLineShowsWhatItCostsAndWhyWithoutSumming` — pure: the line view model exposes price,
      conditions and fired promotions straight from the projection, and the receipt view model reads
      `totals` — no code path adds line values together · pure
- [x] `theBasketTakesCorrections` — drive: quantity, unit of measure and void each re-render from the
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

## Built

Two pure modules, because the two rulings are rules rather than renderings.
`basket-view.ts` is 🚩 **structurally incapable of summing**: `basketLineView` reads ONE line's own
projection and `receiptView` takes `totals` and *is never given the lines* — so the money the caller
is quoted cannot drift from the till's by a later edit, and the drive proves it with totals that
deliberately disagree with the lines on screen. `line-edit.ts` holds the three corrections as **one
action model** (three copies of the id discipline is three chances to get it wrong on a basket the
caller is listening to) plus the two client-side rulings — **only a real correction is sent** (a blur
that changed nothing, an unreadable figure, and zero-or-below, which is a *void* and has its own
verb), and **what the console does not rule on stays the server's**: no client-side per-line cap, and
no unit the projection did not offer.

A line says what it costs and **why** — the store price and VAT as separate conditions, plus the
promotion that fired on it. The two runs are told apart **in words** (*Priced by* / *Offer*), because
the engine projects one discount twice and two −8.40s in a row read as two deductions. A promotion's
amount is the OFFER's and says so when it spans lines; apportioning it would be the console computing
money it was never given.

The quantity field is 🚩 **rendered, not patched**: the draft survives only while that line's own
correction is unfinished, so a refusal, a decline and a `QTY_INVALID` all leave the engine's figure on
screen. A unit control appears only where there is **another** unit to pick — tested on *is there an
alternative*, not on list length, so a single option that differs from the line's unit is still
offered. Voiding one line raises no confirmation (§5's "are you sure" is for what re-prices the whole
basket; the act that throws a basket away keeps its dialog).

A **quantity raised beyond availability takes 169's path unchanged** — same sheet, same `requestId`,
same token — with one addition: the sheet's **words** are the verb's (*Raise it anyway*, not *Add it
anyway*), since one mechanism was never meant to mean one vocabulary. There is **one** acceptance
mounted, fed by whichever verb raised it, so a second surface cannot appear.

`LINE_NOT_FOUND` / `UOM_NOT_AVAILABLE` / `QTY_INVALID` are worded by the console and drawn **on the
line they were about** — the server's own "line L2 not found" tells a mid-call agent nothing about the
screen having fallen behind — and the same wording reaches the **acceptance's** failure, not only the
first send. The delivery fee re-quotes live off `totals.deliveryFee` (the *rule* is 156's), its
threshold is stated so the crossing is watchable, and `waived` is drawn as an **outcome with no
control on it**.

Proof: 30 pure (`basket-view` + `line-edit`) + `callcenter-drive` 390/390.
