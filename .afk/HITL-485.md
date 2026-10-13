# HITL-485 — decisions taken unattended

## Q: URL shape of the store and the leave-outs
**Decision taken:** `store=<code>` (absent = all stores), `leaveOutChurned=false` only when unticked (ticked is the default and absent), `leaveOutTypes=ZC,ZO` (codes comma-joined, de-duplicated, in code order) — after 484's `period`/`pick`/`from`/`to`.
**Why:** mirrors the door's own names, keeps the default URL bare, and one choice has exactly one URL (useUrlQuery compares canonical strings).
**Revisit if:** the owner wants shorter params; only `query.ts` changes.

## Q: Which order types are offered as leave-outs?
**Decision taken:** the `documentTypes` rows of category `O` (order) and `X` (Erx) only, each code once, captioned by description (code when blank), in caption order — exactly the till's `OmsStatisticsDashboard.ReadOrderTypesAsync`. The category is compared trimmed + upper-cased (the till compares exactly).
**Why:** web/till parity; the summary's DocumentType is always the ORDER's type, so delivery types would leave nothing out.
**Revisit if:** BackOffice 2639 changes which type `LeaveOutTypes` matches.

## Q: Should the store picker list only `deliveryStore` stores?
**Decision taken:** no — every open store from `storeDetails`, in code order, labelled `code · city`.
**Why:** a pick-in-store delivery (Picked up) can sit at a store not flagged `deliveryStore`; filtering could hide real figures. The ticket names no filter.
**Revisit if:** the owner wants the list narrowed to delivering stores.

## Q: Arabic copy for the scope controls
**Decision taken:** الفرع / جميع الفروع / استبعاد / إعادات صرف وصفتي المنقطعة / أنواع الطلبات / لا شيء / مسح.
**Why:** the till has no Arabic caption for "Wasfaty churned refills" or "Order types"; these follow the namespace's existing tone.
**Revisit if:** an Arabic reviewer or the till adopts other terms (the Arabic eyeball proof is owner-side).

## Q: Where in the control bar does the scope sit?
**Decision taken:** at the inline end of 484's control bar (`ms-auto`), so the Range tab's own controls appearing never move it; the order-type panel opens anchored to the inline end.
**Why:** no layout was specified; stable controls across tabs.
**Revisit if:** the owner wants the store picker first.

## Q: Graduate a shared checkbox drop-down to `@/core/ui`?
**Decision taken:** no — the order-type picker is a small feature-local component (`ScopeControls.tsx`). The standards review noted it is the third hand-rolled checkbox drop-down (materials `FilterPicker`, deliveries `GridToolbar`/`MyViews`).
**Why:** graduating would rework shipped screens outside this slice.
**Revisit if:** a hardening ticket extracts a core multi-pick.

## Contract gap
None found: 485 adds only the query params the brief names (`StoreCode`, `LeaveOutChurned`, `LeaveOutTypes`) and reads two existing lookups.
