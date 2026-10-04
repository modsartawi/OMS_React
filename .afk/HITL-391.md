# HITL log — ticket 391 (the screens that are not reworked hold under the foundation)

## Q: Two gold markers on /nphies/eligibility/new — foundation breakage, or pre-existing?
**Decision taken:** Fixed. A new pure `markedLeaf(menu, pathname)` in `layout/menu-model.ts` picks the most specific leaf by `matchLength` (the crumb's own rule), and the rail's leaves are plain `Link`s whose `aria-current` and marker read that one answer. Before, the list leaf (prefix `/nphies/eligibility`) and New check both drew the marker and both were `aria-current` (NavLink prefix-matching).
**Why:** The ticket's drive asserts "the rail's marker on the active leaf"; the gold marker is the foundation's (385), and two of them is a defect of the new rail, the same class of bug ticket 284 fixed for settlement.
**Revisit if:** the owner wants the list leaf to stay lit on New check as "you are in the eligibility area" — then mark the area through the group header instead, never a second leaf.

## Q: Hand-rolled pill buttons on the other screens (F7 "Buttons drop the pill")?
**Decision taken:** Left as they are, as 381 ruled (HITL-381 Q4). Only the core `GridPager`'s Previous/Next drop the pill (`rounded-md`) — a core control on every paged grid, the same F7 rule as `core/ui/Button`, and REVIEW-381 asked for exactly that line. About 78 hand-rolled pills remain in 51 files (toolbars, filter chips, Look up / Search / Reset buttons).
**Why:** 391 is "fix only what the foundation broke, no redesign"; the pills render correctly, they are a consistency gap, and adopting shared toolbar pieces is out of scope (361). The Deliveries toolbar goes in S3, Simulation in S5 and the call center in S6.
**Revisit if:** the owner reads F7 as app-wide inside S1. Then it needs its own sweep ticket, with chips (legitimately round) separated from buttons.

## Q: Two grid headers are cut short by Plex (GS1 on Central invoices, Ready's money columns)
**Decision taken:** Widened the hard-coded widths: GS1 175 → 185px (label 149px in 143px), Ready's money columns 150 → 160px ("Cash to Hand Over (SAR)" 139px in 134px).
**Why:** "Hard-coded sizes that Plex disturbs (truncation)" is named in F29. The widths are the smallest that clear the measured labels.
**Revisit if:** the owner prefers the header tooltip to carry the long label over wider columns.

## Q: Alpha-tinted text (`text-muted-foreground/50`, `/60`, `text-foreground/80`): is that a contrast failure the gate can't see?
**Decision taken:** Not touched. All of them are older than S1. Palette B's `--muted-foreground` is darker in light (#46546a vs #586674) and lighter in dark (#a3afc0 vs #98a6b4), so S1 raised their contrast and broke none. The `/50` uses are an `aria-hidden` separator and a disabled hint.
**Why:** The sweep fixes only what the foundation broke.
**Revisit if:** a later screen rework adopts `--ink-3` (the token 381 added to replace the idiom).

## Q: The all-screens drive also visits Home (`/`), which is not a menu leaf
**Decision taken:** Visited, captured and checked (no page error, no clipped header, toast bottom-end), with "no leaf is marked" in place of the marker check.
**Why:** It is the screen everyone lands on and an F5 consumer. Including it costs nothing.
**Revisit if:** nothing.

## Note: the earlier 391 runs
Two earlier sessions of this ticket were killed mid-run (`.afk/partial-391*.patch`). This session took run 2's all-screens pass as its starting point, rewrote its header-clip check against each header's own cell (a column with no group spans the group row too, so the row-based check flagged `BBY #` falsely), and added the cell-height and label-width sweep prints.

## Q: Other form controls still at 8px (`rounded-lg`) besides `NoteField` (found by /standards-review)
**Decision taken:** Moved to `rounded-md` (6px) as well: every input, select and textarea class string that drew `rounded-lg border border-input`. They are in `core/central-invoice/raise.tsx`, authz-admin `EditRoleModal` (2) and `NewRoleModal` (3), ua-admin `NewIdentityModal` and `UserDetailPane`, `LoginPage`'s input class, call-center `SourceForm`, `CentralInvoicePage`, the document `RequestCloseDialog` and `RescheduleDialog`, and `BonusBuyDownloadPage`. `LoginPage`'s read-only `<p>` secret box is not a control and stays 8px.
**Why:** 377 calls `NoteField` "the one exception" to 6px controls, but the same shape sits in these files. F7 says 6px controls. The fix is only the radius class.
**Revisit if:** the owner wanted the sweep held to the one named textarea. Reverting is one class per line.

## Q: `markedLeaf` and the crumb could break a tie differently
**Decision taken:** `markedLeaf` now breaks an equal score the crumb's way: the deeper leaf wins. A test pins the two together on a synthetic menu.
**Why:** /standards-review found the two disagreed on a tie at different depths. No real menu has such a tie today.
**Revisit if:** nothing.
