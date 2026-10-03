---
status: done
spec: 380
blocked-by: 383, 384, 387, 389, 390
---

# 391 — The screens that are not reworked hold under the foundation

The last ticket of step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec
decisions **F29, R1, R2, R3**. The rollout ruling is
[361](361-how-the-ops-console-reaches-main.md).

## What to build

**The breakage sweep (R3, F29).** Walk every screen in the menu under the finished foundation (palette
B, Plex, 26px grids, rail shell, overlays, RTL) and fix **only what the foundation broke**:

- clipped heights under the 26px rows, 28px headers and 28px controls;
- contrast failures the gate can't see (literal colours on tokens, text on the rail);
- hard-coded widths and sizes that Plex's metrics disturb (truncation, wrapped buttons);
- the shipped `NoteField` textarea back to the 6px control radius (377);
- any leftover physical utility or literal pinned side found on the way.

There are **no layout redesigns, no shared page-header or toolbar adoption, and no new features**.
Shared pieces move into core only when the reworked screens need them (361). Record each screen's
verdict (clean / fixed: what) under `## Comments`.

**The S1 sign-off drive.** `tools/foundation-drive.mjs` (built up by 381–390) gains a pass that
visits every menu leaf in **light, dark and RTL** and captures each one. It asserts no page errors,
no clipped grid header, the rail's marker on the active leaf, and toasts at the inline end. The
captures go to `.issues/assets/391-shots/` for the owner.

**Sign-off (R2).** S1 is **one merge** to `main` (361 / R1). It merges only after **the owner signs
off S1 live in light, dark and RTL** against the Far prototype. Built unattended, this ticket closes
when the sweep and drive are done, and **owner sign-off is recorded separately** before the S1 merge.

## Spine reach

Any screen the sweep touches (styling only) · drive · captures.

## Proof (→ `tdd` red-green cycles)

- [x] `tools/foundation-drive.mjs --all-screens` visits every granted menu leaf in light, dark and
  RTL with no page error and no clipped grid header · flow (Playwright)
- [x] `npm run lint`, `typecheck`, `test` and `build` are all green on the finished S1 · gates

## Boundaries

- Styling fixes only. No i18n keys unless a fix replaces a literal it uncovers.
- No endpoints.

## Done when

Every screen's verdict is recorded, the all-screens drive passes in light, dark and RTL with
captures saved, and all gates are green. S1 is then ready for the owner's sign-off.

## Blocked by

[383](383-every-grid-mirrors-under-rtl-and-isolates-its-values.md),
[384](384-ranges-pairs-and-server-text-read-right-in-rtl.md),
[387](387-below-1280-the-rail-overlays-below-640-a-drawer.md),
[389](389-the-bell-opens-a-dense-dropdown.md),
[390](390-a-dialogs-own-failure-shows-inside-the-dialog.md)

## Open questions

- **Owner sign-off of S1** (light, dark and RTL, live) is owed **before** S1 merges to `main`. It is
  not a blocker for closing this ticket in the worktree.

## Comments

**Built unattended, 2026-10-03.** Decisions are logged in `.afk/HITL-391.md`. This is the third session of this
ticket: two earlier runs were killed mid-drive, and this one started from run 2's partial drive
(`.afk/partial-391-run2.patch`).

**Before anything changed:** the all-screens pass ran with no page error on any leaf, in all four modes,
from the first run. That includes no "Maximum update depth exceeded" on `/oms/deliveries`.

**The sweep's fixes:**
- **The rail marked two leaves on `/nphies/eligibility/new`.** Both had the gold marker and both had
  `aria-current`: the list owns the subtree through its prefix, and NavLink prefix-matches.
  - A new pure `markedLeaf(menu, pathname)` in `layout/menu-model.ts` picks the most specific leaf.
    It uses the crumb's own rule (`matchLength`, deeper on a tie).
  - Rail leaves are now plain `Link`s whose `aria-current` and marker read that one answer.
  - Vitest: 7 cases in `menu-model.test.ts`, red first.
  - This is a behaviour fix in the S1 rail (385), not a style fix. It is in scope because the drive
    asserts "the rail's marker on the active leaf".
- **`NoteField` is back to the 6px control radius** (`rounded-md`, 377).
  - So are the 13 other input/select/textarea class strings that drew the same 8px
    `rounded-lg border border-input` shape. /standards-review found them; the list is in the HITL.
- **Plex truncated two grid headers whose widths are hard-coded:**
  - Central invoices' "Serialised in a GS1 market": 175 → 185px (label 149px in 143px).
  - Ready for collection's money columns: 150 → 160px ("Cash to Hand Over (SAR)", 139px in 134px).
  - Measured in en only. Arabic labels do not exist yet.
- **Leftover physical utilities:** six `text-left` → `text-start` in authz-admin
  (`DeleteBlockedModal`, `RoleDetailPane`, `RolesWorkspace` ×2, `UsersWorkspace` ×2).
- **`core/ui/GridPager` drops the pill** (`rounded-md`). This is F7's rule on a core control, as
  REVIEW-381 asked.
  - The roughly 78 hand-rolled pill buttons in 51 files stay, per HITL-381 Q4 and HITL-391.
- **Checked and not broken by S1:**
  - Alpha-tinted text (`text-muted-foreground/50`, `/60`): palette B raised its contrast in both themes.
  - F5's link-ink consumers: already moved by 385.
  - F18's dialog-failure audit: done by 390.
  - No `--sidebar` and no physical `left`/`right` utilities remain in shipped code.

**Verdict per screen.** The drive opens each screen once, with stubbed rows, in light, dark and RTL, and
I read the captures. A verdict covers that opening state. Tabs, detail routes and dialogs beyond it
were swept by grep for the patterns above, not driven.

| Screen | Verdict |
|---|---|
| Home `/` | clean (not a menu leaf; no leaf marked) |
| OMS · Delivery documents | clean (S3 reworks it) |
| OMS · Raise central invoices | fixed: textarea + reason field 6px |
| OMS · Central invoices | fixed: GS1 column width |
| Admin · UA users | fixed: field radius (NewIdentityModal, UserDetailPane); pager drops the pill |
| Admin · Authorization admin | fixed: 6× `text-left` → `text-start`; Edit/New role fields 6px |
| Admin · Active sessions | clean |
| Admin · Send broadcast | clean |
| Call center | clean (chromeless until 407); SourceForm select 6px |
| Loyalty · Member lookup | clean (its member tabs' pager drops the pill through GridPager) |
| Nphies · Eligibility checks | fixed: the rail marker |
| Nphies · Check eligibility | fixed: the rail marker (was doubled with the list) |
| Nphies · Authorizations | clean |
| Collections · Cash collections, ACRs, Deposits, Attempts | clean |
| Collections · Ready for collection | fixed: money column width |
| Collections · Assignment | clean (in-cell selects fit the 26px rows) |
| Collections · Settlement Overview, Open, Ledger, Bulk upload | clean |
| Reports · Invoices | clean |
| Reports · IDoc inspector | clean |
| Pricing · POS simulation | clean (S5 rethemes it) |
| Pricing · Bonus buy download | fixed: textarea 6px |
| Pricing · BBY inquiry | clean (its "BBY #" header spans two rows by design; the drive measures it against its own cell) |
| Pricing · Coupons, Coupon support | clean |
| Document dialogs (Note, Change store, Return, Request close, Reschedule) | fixed: note field and selects 6px |

**What the owner will still see under RTL, and what is not a defect:** English copy under forced RTL puts
a sentence's full stop at its start (".Closed days…"), and AG Grid's own pager summary reads oddly
("to 2 of 2 1"). Both are locale text under `dir="rtl"` with no Arabic locale file. The data values
are isolated.

**Proof:**
- `DRIVE_PORT=5280 node tools/foundation-drive.mjs --all-screens` passes **492/492**: 29 leaves + Home ×
  light/dark × ltr/rtl. Every page is free of errors and every grid header sits inside its own cell
  at 28px. The gold marker and `aria-current` are on that leaf alone. A toast lands at the bottom
  inline-end corner, 16px in. The central-invoice textareas compute 6px (that check was not run red).
  - It also prints any control or header label cut short and any cell content taller than its row.
    The final run printed none; the first run printed the two headers fixed above.
  - **120 captures** are in `.issues/assets/391-shots/` (untracked, for the owner).
- Regression drives touched by the rail change:
  - `DRIVE_ONLY=rail` 96/96, `topbar` 128/128, `narrow` 104/104.
  - `settlement` 291/291 (284's one-leaf `aria-current`), `central-invoice-list` 52/52.
  - `nphies-authorizations` 119/121, with the same 2 FAILs as at 390's HEAD (pre-existing).
- Gates: typecheck clean; `npm test` 172 files, 3176 tests; lint all four gates (731 files, 22 grid mounts,
  148 contrast pairs, 736 files); build green.

**Reviews:**
- `/code-review` (medium): no findings. Its one latent note is now documented on `markedLeaf`: it
  reads the full menu, so a more specific leaf hidden by a different grant would still win.
- `/standards-review`: no hard violation on either axis. Applied:
  - the crumb-matching tie-break;
  - the identity note;
  - the other 8px controls.

  Left as judgement calls:
  - `markedLeaf` is computed per row;
  - the name;
  - the drive's `SCREEN_DATA` copies fixtures from feature drives (tool code).

**Outstanding (owner):**
- **The S1 live sign-off** in light, dark and RTL against the Far prototype (R2) is owed before S1
  merges to `main`.
- **A human eye on Arabic rendering.**
- **The F7 pill question** (HITL-391).
