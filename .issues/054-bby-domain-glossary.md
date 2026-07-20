---
type: wayfinder-ticket
wayfinder: grilling
map: 053
status: done
blocked-by: —
---

# 054 — Bonus Buy domain model & glossary

## Question

Pin the ubiquitous language for BBY so the spec, endpoint DTOs, and UI labels all agree — feed the
result into `CONTEXT.md` via `/domain-modeling`. Resolve:

- **BBY = Bonus Buy**: header (`BbyHeader`) vs the richer `BbyModel`; what "active" means precisely
  (`ValidFrom ≤ now ≤ ValidTo` **and** `BbyStatus`?), and which statuses count as active
  (A=Activated / I=Inactive / D=Draft / X=Deleted — confirm mapping and which are "current").
- **Buy vs Get**: prereqs (Buy side) vs conditions (Get side); "material grouping" (MGP) vs
  "material" (MAT); `LinkCategoryBuy`/`LinkCategoryGet` (AND/OR).
- **`CondTargetType`** incl. the `Document` total-discount mode (e.g. Al-Rajhi 5%) that collapses
  Get to a single header-level discount.
- **String date/time encoding**: `ValidFrom`/`ValidTo` = `yyyyMMdd`, `ValidFromTime`/`ValidToTime`
  = `HHMMSS` — how the UI displays them and how "now"/overlap is computed against them.
- Reuse vs divergence from the sim promo taxonomy (ticket 040 `TAXONOMY.md`, map 039).

Reference: `BbyHeader.cs`, `BonusBuyDetailController.cs` (status/cond/link/discount mappers),
`BbyPrerequisiteTypeConstants`.

## Answer

Glossary pinned into `CONTEXT.md` (revised **Bonus buy**, replaced **Prerequisite / Reward** with
**Buy side / Get side**, added **BBY status**, **Validity window**, **Active / current**, **Link
category**, **Condition target type**). Reconciles with the sim taxonomy (`040 TAXONOMY.md`) rather
than forking it: that asset already maps **buy↔prerequisite**, **get↔reward**, so no divergence.

**Grounding correction (from the WPF sources):** the WPF `BbyInquiryController` does **not** filter
by status or date — it lists the top 1000 `BbyHeader` by `CreatedAt` and shows `BbyStatus` as a raw
column. So "active/current" is a **new concept this react screen introduces**, not a copy.

Decisions taken (grill, 2026-07-20):

1. **Vocabulary = Buy → Get (primary).** UI/prose say "Buy side" / "Get side"; `BbyPrereq` /
   `BbyCond` (`isPrerequisite` / `isCondition`) are the data-layer terms; "reward" = what the get
   side grants. Buy/Get sides can each be a **material** (`MAT`) or **material grouping** (`MGP`).

2. **"Active / current" = `BbyStatus == "A"` AND `ValidFrom ≤ today ≤ ValidTo`** — header-only,
   ordinal `yyyyMMdd` string compare. Explicitly **not** the engine's heavier "will it fire now"
   (cond-level dates + `SyncApprovalStatus` + intra-day time + loyalty), which the inquiry does not
   reproduce. Feeds the list-endpoint contract (057).

3. **`BbyStatus` A/I/D/X is display-only** (Activated/Inactive/Draft/Deleted). The engine's real
   gate is a **separate** `SyncApprovalStatus` column — keep the two distinct in DTOs and labels.

4. **Non-active rows reachable via search.** Default grid = active only; number- and date-range
   search surface any status (incl. `X` = Deleted) and any window; status shown as a badge.

5. **Validity window** = header `ValidFrom`/`ValidTo` (`yyyyMMdd`) + optional `ValidFromTime`/
   `ValidToTime` (`HHMMSS`); date-range search = **validity overlap**, never `CreatedAt`.

6. **`CondTargetType`**: M=Material, G=Material Grouping, P=All Prerequisites, **R=Document**
   (header-level total-discount mode, e.g. Al-Rajhi 5%; Get grid suppressed, single figure shown).
   **Link category**: A=AND, O=OR (`LinkCategoryBuy`/`LinkCategoryGet`).

**Fog notes for later tickets** (not graduated here): `BbyHeaderHistory` **exists** (ULID-keyed
header snapshot, no diff columns) — stays fog per the map until the spec calls for a history
affordance. Two source bugs found in `SqlServerBonusBuyRepository` (a `BbyCond202` load whose SQL
reads `BbyCond201`; `GetBonusBuyByNumber` does no date/status filter) — noted for the **detail
contract** ticket (058), not this one. Detail-shape modelling belongs to ticket 055.
