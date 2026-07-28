# The delivery fee, read again — 2026-07-29

Research asset for map [126](../../126-web-call-center.md) ticket
[156](../../156-delivery-fee-shared-rule.md). Every claim carries file:line, read at
`C:\Work\DMSCO\BackOffice` on 2026-07-29.

**The headline: the ticket's own question is already answered by shipped code.** 156 was written on
2026-07-27 to send the fee rule out of WPF. BackOffice [786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-submission-path.md)
— minted by [133](../../133-submission-path-server-side.md), and now `status: done` — did it. What is
left is not a rule that needs a home; it is **two things the console says about a fee it has**.

---

## 1. Where the rule landed

`Sartawi.Retail.Data/Modules/Pos/Services/CallCenter/CallCenterDeliveryFeePolicy.cs` — a **pure
static** `Compute(CallCenterDeliveryFeeInput, CallCenterDeliveryFeeOptions)`. Nothing ambient: `now`
comes in, the options come in (`:22-23`, the class comment says so explicitly).

Its order of decision, `:34-52`:

| # | line | test |
|---|---|---|
| 1 | `:35` | `!IsDelivery \|\| !SubSourceCarriesFee` ⇒ `0` |
| 2 | `:40` | `BasketTotal >= options.MinimumOrderAmount` ⇒ `0` |
| 3 | `:46` | `options.IsFreeDeliveryWindow(Now)` ⇒ `0` |
| 4 | `:50` | `FeeOverride` (WPF's P2E per-doctype config) |
| 5 | `:52` | `UseWasfatyFee ? WasfatyDeliveryFee : DeliveryFee` |

Both hosts call **this one function**:

- the till / NewPos, through `POSCommon.ShippingAmount` and `POSCommon.ShippingMinimumAmount`, which
  are now thin readers over the shared options (`Sartawi.POS/Common/POSCommon.cs:377-435`, all three
  `786 —` comments);
- SIS.Api twice — the **live quote**
  (`CallCenterSessionService.Harness.cs:277-305`, `QuoteDeliveryFeeAsync`) and the **submit**
  (`CallCenterSubmissionService.cs:101-117`).

Both SIS.Api calls read `BasketTotal = transaction.BalanceDue` (`Harness.cs:292`,
`SubmissionService.cs:112`) and both resolve options through the same
`CallCenterDeliveryFeeOptionsStore(m.Config)`. **So the quoted fee and the charged fee are the same
computation over the same inputs** — which is what 133's requirement actually asked for.

Fifteen tests, no DB, no WPF: `Tests/Data.Tests/CallCenterDeliveryFeePolicyTests.cs` — including
`Pick_in_store_never_carries_a_delivery_fee`, `The_promotional_window_ends_exclusively_on_its_until_date`,
`A_fat_fingered_window_row_does_not_open_an_endless_promotion`.

## 2. The compiled-in campaign window

Gone, and replaced by configuration rather than deleted. `CallCenterDeliveryFeeOptions.FreeDeliveryFrom`
/ `FreeDeliveryUntil` (`:97-101`) default to **exactly** the literal that used to be in `POSCommon`
(`2026-06-20` inclusive → `2026-06-28` exclusive), and are overridden by two `PosConfig` rows
(`PosConfigKeys.cs:237-238`):

```
CallCenter.DeliveryFee.FreeFrom     yyyy-MM-dd | yyyy-MM-dd HH:mm | NONE
CallCenter.DeliveryFee.FreeUntil    ditto
```

`"NONE"` closes the window **without deleting the row** (`:152-156`) — the ops move when a promotion
ends. Dates parse `InvariantCulture`, exact-format, local wall-clock (`:159-163`); a decimal parses
invariantly and a **negative is refused** because it would credit the customer for delivery (`:144`).
An unparseable value leaves the shipped default standing (`:116-136`) rather than zeroing a fee.

Three more numbers moved the same way: `CallCenter.DeliveryFee.MinimumOrderAmount`, `.Amount`,
`.WasfatyAmount`.

⚠ Found on the way, worth naming: `POSCommon`'s annotation on the standard fee read `// 10m` and the
real `DeliveryFeesConstants.DeliveryFees` is **12.0** — the comment was stale by two riyals, and 156's
own question text inherited the wrong number from it. The options default is the constant, not the
comment (`CallCenterDeliveryFeePolicy.cs:91`).

## 3. `thresholdGross` is real

`ShippingMinimumAmount` → `CallCenterDeliveryFeeOptions.MinimumOrderAmount`, **100 SAR** since
2022-04-01. The pre-2022 `50m` branch (`POSCommon.cs:390-395`) is dead on every date since and is
**deliberately not carried** into the options (`:86-87`). `QuoteDeliveryFeeAsync` puts it on the wire
as `thresholdGross` (`Harness.cs:302`), and capture
[`09-fulfilment-flip.json`](../136-cc-contract/09-fulfilment-flip.json) shows `100` in every one of
its three states.

So the contract invented nothing. The correction 154 already wrote onto this ticket holds; this note
only confirms it against the shipped code rather than against WPF.

## 4. Pick-in-store

Rule, not UI — `CallCenterDeliveryFeePolicy.cs:35` is the **first** predicate. And `waived` is
deliberately **false** there, not true: `Harness.cs:299-301` — *"a fee that never existed was not
waived."* Capture `09` line 206-211 is the proof: `amount: 0, waived: false, thresholdGross: 100`.

## 5. The console side — where the two remaining findings are

The no-manual-waiver ruling is **honoured by construction**: there is no waiver control anywhere in
`src/features/callcenter/`, no verb takes a fee, and `basket-view.ts:129-143` says why in a comment.
`receiptView` takes `totals` and is not given the lines, so it *could not* compute a fee if a later
edit wanted to (`basket-view.ts:154-158`).

### 🚩 A. `waived: true` says nothing about why

`Harness.cs:301` collapses every cause into one boolean: `Waived = isDelivery && amount == 0m`. Two
causes are live in phase 1 — the **threshold** (`:40`) and the **promotional window** (`:46`) — and
the console makes the gap worse than the wire does: `ConsoleShell.tsx:546` shows the *"free over SAR
100"* line **only when `!waived`**, so at the moment the fee falls away the one sentence that would
have explained it disappears with it.

An agent asked *"why is my delivery free?"* has nothing to read. Say it out loud during a promotion
and they will say *"because you're over 100"*, which may be false.

**The client cannot derive it, and must not try.** It holds `gross` and `thresholdGross` and could
compare them — but that is the client recomputing a server rule, against §2.1 and against
`basket-view.ts`'s own stated law, and it is wrong the moment a fourth cause exists (the P2E
`FeeOverride` of 0, `:50`, which is out of phase 1 but not out of the policy).

Cheapest honest answer: the server already knows which branch it took. Ship the branch.

### 🚩 B. Under pickup the console draws a delivery row of 0.00 and promises free delivery

With capture `09`'s pickup state (`amount: 0, waived: false, thresholdGross: 100`), `ConsoleShell.tsx`
renders **both** halves:

- `:524` — `receipt.delivery` is non-null (the block always ships), so the receipt shows
  **`Delivery   SAR 0.00`** on an order nobody is delivering;
- `:546` — `!waived && thresholdGross !== null` is true, so under it sits
  **"free over SAR 100"** — a delivery promise on a collection order.

Not user-visible *yet*, only because the mode axis is undrawn — which is exactly
[176](../../176-fulfilment-mode-drawn.md)'s open ticket. It becomes visible the day 176 lands, so it
belongs to 176 as a requirement, not to a future bug report.

The fix is a display rule and needs no wire change: the fee region is **absent** under
`deliveryType == "PickInStore"`, the same absent-not-disabled posture 175 chose for the item command
line. The block still ships on the wire — the flip back has to re-quote instantly — the console
simply does not draw it.

## 6. Residual risks, named and not designed

- **Quote-vs-submit drift within one call.** The two calls recompute; they do not pin. A call that
  crosses the campaign window's midnight boundary, or an ops `PosConfig` edit landing between them
  (the options cache is process-wide with a 5-minute TTL, `CallCenterDeliveryFeePolicy.cs:189, 236-262`),
  quotes one fee and charges another. Rare, real, and *not* a till-vs-web parity break — both hosts
  share the source. Recorded rather than fixed: pinning the quoted fee into the submit would
  contradict §8.3's *"quoted live, never computed at submit"*.
- **Nothing in the estate edits these `PosConfig` rows through a UI.** Ending a promotion is a SQL
  row edit today. That is the same posture every other `PosConfig` key has and is past this map's
  destination — but it is the operational cost of the "configuration not recompile" answer, and
  somebody should know it before the first campaign.
- **Precedence when two waivers are true at once.** A 150 SAR basket during the campaign reports the
  threshold, because `:40` runs before `:46`. Both are honest; the ordering is documented in the
  policy and now on the wire.
