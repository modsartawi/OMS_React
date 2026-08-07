---
type: wayfinder-ticket
wayfinder: grilling
map: 240
status: open
blocked-by: 241, 242, 243
---

# 245 — The shape of a print-ready document

## Question

The map settled that the builders run server-side and React renders a **print-ready model** —
pre-formatted money strings, Arabic amount-in-words, pre-paginated pages — so the WPF and web
outputs cannot drift. Design that contract. It is the whole backend wave and the frontend wave's
only input for the two documents.

With the fidelity inventory (242), the existing contract (243) and the print decision (241) in hand,
settle:

- **The two endpoints.** Routes, parameters, and what identifies a document — a collection row's
  key for the receipt, an ACR id for the form. Do they hang off the existing `PosCollection/*` and
  `Acr/*` tags, or a new one?
- **The model.** Field-by-field, mirroring `CollectionVoucherModel` / `AcrForm` + `AcrFormRow` +
  `AcrFormPage`. Every money value arrives as a *string* already formatted for its currency, and
  the whole/minor split arrives split. Nothing on the client formats an amount — that is the rule
  the WPF control already lives by and the reason the two agree.
- **Where the boundary sits on labels.** The map's exception makes the Arabic literals part of the
  React facsimile. Confirm that against 242: any label that is actually conditional or data-driven
  (`VarianceText`, `MatchedMarkText`, `MatchText`, the `صفحة {0}` stamp, the `ar-SA` weekday) is
  *data* and comes from the server; only the fixed chrome is a literal in the component.
- **Pagination ownership.** The server pre-paginates (`AcrFormBuilder.Paginate`, 22 rows/page,
  summary on the last page). Confirm the model carries pages explicitly, and what the receipt's
  multi-page case is — `CollectionVoucherBuilder.BuildPages` returns a list, so when is a receipt
  more than one page?
- **If 241 chose server PDF**, this ticket instead specifies the PDF endpoint plus whatever
  on-screen model the web still needs, and says explicitly how the on-screen view is kept from
  diverging from the printed artifact.
- **Whether the frontend can start against a mock.** If the answer is yes, the contract written
  here *is* the mock, and the two waves genuinely run in parallel. Say so, and say what the
  frontend must not assume.

**Input from 242:** the inventory is
[`assets/242-fidelity-inventory.RESEARCH.md`](assets/242-fidelity-inventory.RESEARCH.md); its §7 is
the complete list of computed strings the model owes, and §2/§4 name the field behind every mark.
Four findings land squarely on this contract:

- **`ar-SA` weekday** (`ShiftDay` as `dddd`) is the one value whose output depends on the .NET
  culture — and `ar-SA` is an Umm al-Qura (Hijri) calendar culture. Pin it as a server-formatted
  string; do not re-derive it in JS.
- **The HQ path drops the rounding flags** (§8-O4): `FromInquiryRow` copies `Variance` but leaves
  `CashRoundingMatched`/`Absorbed` false, so the green `مطابق` mark can never render on the path the
  web uses. Either the model carries the flags or the mark is out.
- **Three model fields the WPF builds but never binds** — `IsShortfall`, `DepositNumber`,
  `DepositStatus` (§8-O6, O7). Decide in or out before the contract freezes.
- **`Z report missing`** is a raw English literal minted by the builder into an Arabic form
  (§8-O5) — server-supplied, so it passes as data, but it is ours to choose.

Record the contract in the answer precisely enough that `/to-spec` can lift it verbatim.

## Comments

**From 246 (2026-08-07) — the receipt half of your contract just got smaller.**

The sign-off removed the green POSTED banner (`No.` *is* the posted state) and ruled the
`خصم فائض` box **always empty** — a hand-fill slot, not an output field. So the receipt's
print-ready model carries **no reconciliation data at all**: not `IsPosted`, not `VarianceText`,
not `MatchedMarkText`, and not the `CashRoundingMatched` / `CashRoundingAbsorbed` flags that
242 §8-O4 asked you to consider carrying. `CashRounding.Reconcile` never runs on the receipt path.
(Unchanged for the ACR, where `MatchText` is a real per-row output.)

The mock in
[`voucher-mock.ts`](../src/features/oms/collection/__prototype__/voucher/voucher-mock.ts) is a
first sketch of the shape — note that nothing on it is a number, a `Date`, or a currency code, and
that `shiftDayName` is pinned server-side because `ar-SA` is a Hijri culture. Strip the four dead
fields listed above from it and it is close to the contract.

**From 247 (2026-08-07) — and now the ACR half.**

The ACR's print-ready model is `AcrFormBuilder`'s output with three edits, all from the sign-off:

- **`OperatorId` → `PharmacistId`** — the column is `رقم الصيدلي`, the closer *is* the pharmacist.
- **`DepositNumber`, `DepositStatus` and `DepositText` all leave.** Not just the two unbound fields
  242 §8-O7 asked about: the sign-off removed `اجمالي ايداع المحصل` from `ملخص التحصيل` too, so the
  summary carries one row (`اجمالي الايرادات` = the grand total) and the ACR says nothing about
  banking. `CashTotalText` still earns its place — it is the `الاجمالي` band's cash column.
- **One new field: the Hijri `الموافق` date**, pre-formatted server-side (`dd/MM/yyyy` Umm al-Qura)
  like every other string on the form, for the same reason `shiftDayName` is: the calendar is a
  .NET culture question, not a JS one.

Unchanged: `MatchText` is a real per-row output, and `AcrNumberText` now renders under the label
`رقم التجميعي`. `Notes` should arrive **in Arabic** (§8-O5): `Z report missing` is our literal, not
the server's data, so the fix is in the builder.

Two shape notes the mock in
[`acr-mock.ts`](../src/features/oms/collection/__prototype__/acr/acr-mock.ts) makes concrete:
nothing on it is a number or a `Date`, and **pagination is part of the contract** — the endpoint
hands over pages (or `rowsPerPage` plus the arithmetic), because the browser choosing its own page
breaks is exactly what 241 ruled out.
